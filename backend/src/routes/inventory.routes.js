const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');
const { bookStockMutation, getLowStockProducts, predictRestockNeeds } = require('../services/stockService');

const router = express.Router();
router.use(authenticate);

// GET /api/inventory/stock — current stock per product
router.get('/stock', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, currentStock: true, minStock: true, saleUnit: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/mutations?productId= — full immutable movement history for a product
router.get('/mutations', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    const { productId } = req.query;
    const mutations = await prisma.stockMutation.findMany({
      where: productId ? { productId } : {},
      include: { product: { select: { name: true, sku: true } }, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(mutations);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/adjustments — history of manual stock corrections (never deleted)
router.get('/adjustments', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    const adjustments = await prisma.stockAdjustment.findMany({
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(adjustments);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/adjustments — GUDANG/OWNER records a stock correction
// (e.g. after stock opname finds a discrepancy, or goods are damaged/expired).
router.post(
  '/adjustments',
  authorize('OWNER', 'GUDANG'),
  [
    body('productId').isUUID(),
    body('quantityDelta').isInt().custom((v) => v !== 0).withMessage('quantityDelta tidak boleh 0'),
    body('reason').isIn(['DAMAGED', 'LOST', 'EXPIRED', 'STOCK_OPNAME', 'OTHER']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { productId, quantityDelta, reason, note } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const adjustment = await tx.stockAdjustment.create({
          data: { productId, quantityDelta, reason, note, approvedById: req.user.id },
        });

        await bookStockMutation(tx, {
          productId,
          type: 'ADJUSTMENT',
          quantity: quantityDelta,
          referenceType: 'StockAdjustment',
          referenceId: adjustment.id,
          note: note || reason,
          userId: req.user.id,
        });

        return adjustment;
      });

      await writeAuditLog({ req, action: 'STOCK_ADJUSTMENT', entityType: 'Product', entityId: productId, after: result });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/inventory/alerts — products at/below minStock
router.get('/alerts', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    res.json(await getLowStockProducts());
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/restock-prediction — projected restock needs from sales velocity
router.get('/restock-prediction', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    const windowDays = parseInt(req.query.windowDays || '30', 10);
    const targetDaysOfCover = parseInt(req.query.targetDaysOfCover || '14', 10);
    res.json(await predictRestockNeeds({ windowDays, targetDaysOfCover }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
