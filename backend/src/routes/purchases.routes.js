const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');
const { extractReceiptData, matchProductName } = require('../services/ocrService');
const { bookStockMutation } = require('../services/stockService');
const { applyWeightedAverageCost } = require('../services/hppService');
const { generatePurchaseNumber } = require('../utils/idGenerator');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './storage/receipts';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `nota-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB || '8', 10)) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Hanya file gambar (jpg/png/webp) yang diizinkan.'));
    cb(null, true);
  },
});

// POST /api/purchases/upload-receipt — GUDANG/OWNER upload foto nota, sistem OCR + AI ekstrak isinya.
router.post('/upload-receipt', authorize('OWNER', 'GUDANG'), upload.single('receipt'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'File foto nota wajib diunggah.' });

    const extracted = await extractReceiptData(req.file.path, req.file.mimetype);
    const products = await prisma.product.findMany({ where: { isActive: true } });

    const purchaseNumber = await generatePurchaseNumber();

    // Try to match each OCR'd line to a master product.
    const itemsWithMatch = extracted.items.map((item) => {
      const { product, score } = matchProductName(item.rawName, products);
      return { ...item, productId: product ? product.id : null, matchedConfidence: score, needsVerification: !product };
    });

    const anyUnmatched = itemsWithMatch.some((i) => i.needsVerification);

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber,
        status: anyUnmatched ? 'NEEDS_VERIFICATION' : 'VERIFIED',
        receiptImageUrl: req.file.path,
        ocrRawText: extracted.rawText,
        ocrConfidence: extracted.confidence,
        totalAmount: extracted.totalAmount,
        createdById: req.user.id,
        items: {
          create: itemsWithMatch.map((i) => ({
            productId: i.productId,
            rawName: i.rawName,
            matchedConfidence: i.matchedConfidence,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
            needsVerification: i.needsVerification,
          })),
        },
      },
      include: { items: true },
    });

    await writeAuditLog({ req, action: 'PURCHASE_OCR_INGESTED', entityType: 'Purchase', entityId: purchase.id, after: { purchaseNumber, itemCount: itemsWithMatch.length, anyUnmatched } });

    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
});

// PUT /api/purchases/:id/items/:itemId — resolve an unverified line item by linking/creating a product.
router.put(
  '/:id/items/:itemId',
  authorize('OWNER', 'GUDANG'),
  [body('productId').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const item = await prisma.purchaseItem.update({
        where: { id: req.params.itemId },
        data: { productId: req.body.productId, needsVerification: false },
      });
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchases/:id/post — finalize a verified purchase: books stock IN + recalculates HPP (weighted average).
router.post('/:id/post', authorize('OWNER', 'GUDANG'), async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!purchase) return res.status(404).json({ error: 'Pembelian tidak ditemukan.' });
    if (purchase.status === 'POSTED') return res.status(409).json({ error: 'Pembelian sudah diposting sebelumnya.' });

    const unresolved = purchase.items.filter((i) => i.needsVerification || !i.productId);
    if (unresolved.length > 0) {
      return res.status(422).json({ error: 'Masih ada item yang perlu diverifikasi sebelum stok dapat ditambahkan.', unresolved });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        // Convert purchase unit quantity to sale-unit stock using contentPerPack if relevant
        // (kept 1:1 here for clarity; adjust per-item conversion as needed in production).
        await applyWeightedAverageCost(tx, {
          productId: item.productId,
          incomingQty: item.quantity,
          incomingUnitCost: item.unitPrice,
          reason: 'PURCHASE',
          referenceId: purchase.id,
          userId: req.user.id,
        });

        await bookStockMutation(tx, {
          productId: item.productId,
          type: 'PURCHASE_IN',
          quantity: Math.round(Number(item.quantity)),
          referenceType: 'Purchase',
          referenceId: purchase.id,
          note: `Pembelian ${purchase.purchaseNumber}`,
          userId: req.user.id,
        });
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'POSTED', verifiedById: req.user.id, verifiedAt: new Date() },
      });
    });

    await writeAuditLog({ req, action: 'PURCHASE_POSTED', entityType: 'Purchase', entityId: purchase.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/purchases — list with filters
router.get('/', authorize('OWNER', 'MANAGER', 'GUDANG'), async (req, res, next) => {
  try {
    const { status, supplierId } = req.query;
    const purchases = await prisma.purchase.findMany({
      where: { ...(status ? { status } : {}), ...(supplierId ? { supplierId } : {}) },
      include: { supplier: true, items: true, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(purchases);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
