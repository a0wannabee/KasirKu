const express = require('express');
const { body, query } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');
const { generateSku } = require('../utils/idGenerator');
const { manualHppAdjustment } = require('../services/hppService');

const router = express.Router();
router.use(authenticate);

// GET /api/products?search=&categoryId=&page=&limit=
// Readable by everyone authenticated (kasir needs it for search-by-name).
router.get('/', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 200 })], validate, async (req, res, next) => {
  try {
    const { search, categoryId } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);

    const where = {
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true }, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, suppliers: { include: { supplier: true } }, hppHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

const productValidation = [
  body('name').trim().notEmpty().withMessage('Nama produk wajib diisi.'),
  body('categoryId').isUUID(),
  body('purchaseUnit').trim().notEmpty(),
  body('saleUnit').trim().notEmpty(),
  body('contentPerPack').optional().isInt({ min: 1 }),
  body('sellPrice').isFloat({ min: 0 }),
  body('minStock').optional().isInt({ min: 0 }),
  body('barcode').optional({ nullable: true }).trim(),
];

// POST /api/products — OWNER and GUDANG can create master product entries
// (GUDANG needs this so unverified purchase items can be turned into real products)
router.post('/', authorize('OWNER', 'GUDANG'), productValidation, validate, async (req, res, next) => {
  try {
    const sku = await generateSku();
    const product = await prisma.product.create({
      data: {
        sku,
        name: req.body.name,
        categoryId: req.body.categoryId,
        barcode: req.body.barcode || null,
        purchaseUnit: req.body.purchaseUnit,
        saleUnit: req.body.saleUnit,
        contentPerPack: req.body.contentPerPack || 1,
        hpp: req.body.hpp || 0,
        sellPrice: req.body.sellPrice,
        minStock: req.body.minStock || 0,
      },
    });

    await writeAuditLog({ req, action: 'PRODUCT_CREATE', entityType: 'Product', entityId: product.id, after: product });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/bulk — bulk create products from OCR items
router.post('/bulk', authorize('OWNER', 'GUDANG'), async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items harus berupa array.' });
    }

    const createdProducts = [];

    await prisma.$transaction(async (tx) => {
      // Find a default category fallback
      const firstCategory = await tx.category.findFirst({ orderBy: { name: 'asc' } });
      const defaultCategoryId = firstCategory ? firstCategory.id : null;

      for (const item of items) {
        if (!item.name || !item.name.trim()) {
          throw new Error('Nama produk wajib diisi.');
        }

        let categoryId = item.categoryId || defaultCategoryId;

        // If categoryName is provided, find or create it
        if (item.categoryName && item.categoryName.trim()) {
          const catName = item.categoryName.trim();
          const existingCat = await tx.category.findFirst({
            where: { name: { equals: catName, mode: 'insensitive' } }
          });
          if (existingCat) {
            categoryId = existingCat.id;
          } else {
            const newCat = await tx.category.create({ data: { name: catName } });
            categoryId = newCat.id;
          }
        }

        if (!categoryId) {
          throw new Error('Kategori wajib dipilih.');
        }

        const sku = await generateSku();
        const product = await tx.product.create({
          data: {
            sku,
            name: item.name.trim(),
            categoryId,
            barcode: item.barcode || null,
            purchaseUnit: item.purchaseUnit || 'Karton',
            saleUnit: item.saleUnit || 'Pcs',
            contentPerPack: Number(item.contentPerPack) || 1,
            hpp: Number(item.hpp) || 0,
            sellPrice: Number(item.sellPrice) || 0,
            minStock: Number(item.minStock) || 0,
          }
        });

        // If linking to a purchase item, update it
        if (item.purchaseItemId) {
          await tx.purchaseItem.update({
            where: { id: item.purchaseItemId },
            data: {
              productId: product.id,
              needsVerification: false,
              matchedConfidence: 1.0,
            }
          });
        }

        createdProducts.push(product);
      }
    });

    await writeAuditLog({ req, action: 'PRODUCT_BULK_CREATE', entityType: 'Product', entityId: 'BULK', after: { count: createdProducts.length } });

    // Recalculate purchase totals/statuses for affected purchases
    const purchaseIds = [...new Set(items.map(it => it.purchaseId).filter(Boolean))];
    for (const pId of purchaseIds) {
      const allItems = await prisma.purchaseItem.findMany({ where: { purchaseId: pId } });
      const totalAmount = allItems.reduce((sum, it) => sum + Number(it.subtotal), 0);
      const anyUnmatched = allItems.some((i) => i.needsVerification || !i.productId);
      await prisma.purchase.update({
        where: { id: pId },
        data: {
          totalAmount,
          status: allItems.length === 0 ? 'VERIFIED' : (anyUnmatched ? 'NEEDS_VERIFICATION' : 'VERIFIED'),
        }
      });
    }

    res.status(201).json({ success: true, count: createdProducts.length });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// PUT /api/products/:id — OWNER only for full edits (price, min stock, etc.)
router.put('/:id', authorize('OWNER'), productValidation, validate, async (req, res, next) => {
  try {
    const before = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    // HPP changes are never allowed through this generic update endpoint —
    // they must go through /products/:id/hpp-adjustment so a history record
    // is always created. Silently ignore any hpp field in this payload.
    const { hpp, ...rest } = req.body;

    const after = await prisma.product.update({ where: { id: req.params.id }, data: rest });
    await writeAuditLog({ req, action: 'PRODUCT_UPDATE', entityType: 'Product', entityId: after.id, before, after });
    res.json(after);
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/hpp-adjustment — the ONLY way to change HPP manually.
router.post(
  '/:id/hpp-adjustment',
  authorize('OWNER'),
  [body('newHpp').isFloat({ min: 0 }), body('reason').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const updated = await manualHppAdjustment({
        productId: req.params.id,
        newHpp: req.body.newHpp,
        reason: req.body.reason,
        userId: req.user.id,
      });
      await writeAuditLog({ req, action: 'HPP_MANUAL_ADJUSTMENT', entityType: 'Product', entityId: req.params.id, after: { newHpp: req.body.newHpp, reason: req.body.reason } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/products/:id — soft delete only (isActive = false). Products
// are never hard-deleted because SaleItem/PurchaseItem/StockMutation
// reference them and history must remain intact.
router.delete('/:id', authorize('OWNER'), async (req, res, next) => {
  try {
    const before = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    const after = await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    await writeAuditLog({ req, action: 'PRODUCT_DEACTIVATE', entityType: 'Product', entityId: after.id, before, after });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
