const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');
const { bookStockMutation } = require('../services/stockService');
const { generateInvoiceNumber } = require('../utils/idGenerator');

const router = express.Router();
router.use(authenticate);

const checkoutValidation = [
  body('items').isArray({ min: 1 }).withMessage('Keranjang tidak boleh kosong.'),
  body('items.*.productId').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.discount').optional().isFloat({ min: 0 }),
  body('discountAmount').optional().isFloat({ min: 0 }),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }),
  body('paymentMethod').isIn(['CASH', 'TRANSFER', 'QRIS', 'CARD']),
  body('amountPaid').isFloat({ min: 0 }),
];

// POST /api/sales/checkout — KASIR/OWNER creates a sale. Atomic: stock is
// decremented and the sale is recorded together, or neither happens.
router.post('/checkout', authorize('OWNER', 'KASIR'), checkoutValidation, validate, async (req, res, next) => {
  try {
    const { items, discountAmount = 0, taxRate = 0, paymentMethod, amountPaid } = req.body;

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) return res.status(404).json({ error: `Produk ${item.productId} tidak ditemukan.` });
      if (product.currentStock < item.quantity) {
        return res.status(409).json({ error: `Stok ${product.name} tidak mencukupi (sisa ${product.currentStock}).` });
      }
    }

    let subtotal = 0;
    let totalHpp = 0;
    const saleItemsData = items.map((item) => {
      const product = productMap.get(item.productId);
      const lineDiscount = item.discount || 0;
      const lineSubtotal = product.sellPrice * item.quantity - lineDiscount;
      subtotal += lineSubtotal;
      totalHpp += Number(product.hpp) * item.quantity;
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.sellPrice,
        unitHpp: product.hpp,
        discount: lineDiscount,
        subtotal: lineSubtotal,
      };
    });

    const afterDiscount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = Number(((afterDiscount * taxRate) / 100).toFixed(2));
    const totalAmount = afterDiscount + taxAmount;

    if (amountPaid < totalAmount && paymentMethod === 'CASH') {
      return res.status(422).json({ error: 'Jumlah pembayaran kurang dari total.' });
    }

    const invoiceNumber = await generateInvoiceNumber();

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          cashierId: req.user.id,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          totalHpp,
          paymentMethod,
          amountPaid,
          changeAmount: paymentMethod === 'CASH' ? Math.max(amountPaid - totalAmount, 0) : 0,
          items: { create: saleItemsData },
        },
        include: { items: true },
      });

      for (const item of saleItemsData) {
        await bookStockMutation(tx, {
          productId: item.productId,
          type: 'SALE_OUT',
          quantity: -item.quantity,
          referenceType: 'Sale',
          referenceId: created.id,
          note: `Penjualan ${invoiceNumber}`,
          userId: req.user.id,
        });
      }

      return created;
    });

    await writeAuditLog({ req, action: 'SALE_CREATED', entityType: 'Sale', entityId: sale.id, after: { invoiceNumber, totalAmount } });
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales — transaction history
router.get('/', authorize('OWNER', 'MANAGER', 'KASIR'), async (req, res, next) => {
  try {
    // KASIR only sees their own transactions; OWNER/MANAGER see all.
    const where = req.user.role === 'KASIR' ? { cashierId: req.user.id } : {};
    const sales = await prisma.sale.findMany({
      where,
      include: { items: { include: { product: { select: { name: true } } } }, cashier: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(sales);
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id — receipt detail (for reprint)
router.get('/:id', authorize('OWNER', 'MANAGER', 'KASIR'), async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } }, cashier: { select: { fullName: true } } },
    });
    if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (req.user.role === 'KASIR' && sale.cashierId !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak berhak melihat transaksi kasir lain.' });
    }
    res.json(sale);
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/:id/void — OWNER only. Never hard-deletes the sale; marks
// it VOID, restores stock, and always requires + records a reason.
router.post('/:id/void', authorize('OWNER'), [body('reason').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (sale.status !== 'COMPLETED') return res.status(409).json({ error: 'Transaksi ini sudah tidak berstatus COMPLETED.' });

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        await bookStockMutation(tx, {
          productId: item.productId,
          type: 'RETURN_IN',
          quantity: item.quantity,
          referenceType: 'Sale',
          referenceId: sale.id,
          note: `Void transaksi ${sale.invoiceNumber}: ${req.body.reason}`,
          userId: req.user.id,
        });
      }
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'VOID', voidReason: req.body.reason, voidedById: req.user.id, voidedAt: new Date() },
      });
    });

    await writeAuditLog({ req, action: 'SALE_VOID', entityType: 'Sale', entityId: sale.id, before: sale, after: { reason: req.body.reason } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/:id/return — partial/full return of specific items
router.post(
  '/:id/return',
  authorize('OWNER', 'KASIR'),
  [body('items').isArray({ min: 1 }), body('items.*.productId').isUUID(), body('items.*.quantity').isInt({ min: 1 }), body('reason').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const sale = await prisma.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

      const results = await prisma.$transaction(async (tx) => {
        const created = [];
        for (const returnItem of req.body.items) {
          const saleItem = sale.items.find((i) => i.productId === returnItem.productId);
          if (!saleItem) throw new Error(`Produk ${returnItem.productId} tidak ada dalam transaksi ini.`);
          if (returnItem.quantity > saleItem.quantity) throw new Error(`Jumlah retur melebihi jumlah pembelian untuk produk ini.`);

          const refundAmount = (Number(saleItem.unitPrice) - Number(saleItem.discount) / saleItem.quantity) * returnItem.quantity;

          const ret = await tx.saleReturn.create({
            data: {
              saleId: sale.id,
              productId: returnItem.productId,
              quantity: returnItem.quantity,
              reason: req.body.reason,
              refundAmount,
              processedById: req.user.id,
            },
          });

          await bookStockMutation(tx, {
            productId: returnItem.productId,
            type: 'RETURN_IN',
            quantity: returnItem.quantity,
            referenceType: 'SaleReturn',
            referenceId: ret.id,
            note: `Retur dari ${sale.invoiceNumber}: ${req.body.reason}`,
            userId: req.user.id,
          });

          created.push(ret);
        }

        await tx.sale.update({ where: { id: sale.id }, data: { status: 'PARTIALLY_RETURNED' } });
        return created;
      });

      await writeAuditLog({ req, action: 'SALE_RETURN', entityType: 'Sale', entityId: sale.id, after: results });
      res.status(201).json(results);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
