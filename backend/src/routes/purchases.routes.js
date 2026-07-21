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
const { extractReceiptData, matchProductName, getOcrStatus } = require('../services/ocrService');
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

// GET /api/purchases/ocr-status — returns current OCR provider configuration status.
// Safe to expose to authenticated clients: no secrets are included.
router.get('/ocr-status', authorize('OWNER', 'GUDANG'), (req, res) => {
  res.json(getOcrStatus());
});

// POST /api/purchases/upload-receipt — GUDANG/OWNER upload foto nota, sistem OCR + AI ekstrak isinya.
router.post('/upload-receipt', authorize('OWNER', 'GUDANG'), (req, res, next) => {
  upload.single('receipt')(req, res, (err) => {
    if (err) {
      const { AppError } = require('../utils/AppError');
      const { MulterError } = require('multer');
      if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`Ukuran file terlalu besar. Maksimum ${process.env.MAX_UPLOAD_MB || 8} MB.`, 422, 'UPLOAD_TOO_LARGE'));
      }
      return next(new AppError(err.message || 'Gagal mengunggah file.', 422, 'UPLOAD_FAILED'));
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'File foto nota wajib diunggah.' });

    let extracted;
    if (req.query.simulate === 'true') {
      extracted = {
        supplierName: 'PT Sumber Alfaria Trijaya (Simulasi)',
        receiptDate: new Date().toISOString(),
        confidence: 0.95,
        rawText: 'MOCK OCR RESULT FOR TESTING AND VERIFICATION',
        totalAmount: 95000,
        items: [
          { rawName: 'Sabun Lifebuoy Blue', quantity: 5, unit: 'pcs', unitPrice: 5000, subtotal: 25000 },
          { rawName: 'Aqua Botol 600ml', quantity: 10, unit: 'pcs', unitPrice: 3000, subtotal: 30000 },
          { rawName: 'Kopi Kapal Api Mock', quantity: 2, unit: 'renteng', unitPrice: 20000, subtotal: 40000 }
        ]
      };
    } else {
      extracted = await extractReceiptData(req.file.path, req.file.mimetype);
    }
    const products = await prisma.product.findMany({ where: { isActive: true } });

    const purchaseNumber = await generatePurchaseNumber();

    // Try to match each OCR'd line to a master product using auto-learning and tiered fuzzy matching.
    const itemsWithMatch = await Promise.all(extracted.items.map(async (item) => {
      // 1. Check Auto-Learning first (query database for previous successful mapping)
      const learned = await prisma.purchaseItem.findFirst({
        where: {
          rawName: item.rawName,
          productId: { not: null },
          purchase: { status: 'POSTED' }
        },
        include: { product: true },
        orderBy: { createdAt: 'desc' }
      });

      if (learned && learned.product) {
        return {
          ...item,
          productId: learned.product.id,
          matchedConfidence: 1.0,
          needsVerification: false,
        };
      }

      // 2. Otherwise fall back to fuzzy matching
      const { product, score } = matchProductName(item.rawName, products);

      // Score-based threshold mapping:
      // score >= 0.75 -> Matched (needsVerification = false)
      // 0.4 <= score < 0.75 -> Review (needsVerification = true, but productId preselected)
      // score < 0.4 -> New Product (needsVerification = true, productId = null)
      if (product && score >= 0.75) {
        return {
          ...item,
          productId: product.id,
          matchedConfidence: score,
          needsVerification: false,
        };
      } else if (product && score >= 0.4) {
        return {
          ...item,
          productId: product.id,
          matchedConfidence: score,
          needsVerification: true,
        };
      } else {
        return {
          ...item,
          productId: null,
          matchedConfidence: score,
          needsVerification: true,
        };
      }
    }));

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

// PUT /api/purchases/:id/items/:itemId — resolve or update quantity/price of a line item.
router.put(
  '/:id/items/:itemId',
  authorize('OWNER', 'GUDANG'),
  [
    body('productId').optional().isUUID(),
    body('quantity').optional().isFloat({ min: 0 }),
    body('unitPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { productId, quantity, unitPrice } = req.body;
      const currentItem = await prisma.purchaseItem.findUnique({ where: { id: req.params.itemId } });
      if (!currentItem) return res.status(404).json({ error: 'Item tidak ditemukan.' });

      const newQty = quantity !== undefined ? Number(quantity) : Number(currentItem.quantity);
      const newPrice = unitPrice !== undefined ? Number(unitPrice) : Number(currentItem.unitPrice);
      const newSubtotal = newQty * newPrice;

      const data = {
        subtotal: newSubtotal,
        quantity: newQty,
        unitPrice: newPrice,
      };

      if (productId !== undefined) {
        data.productId = productId;
        data.needsVerification = false;
      }

      const item = await prisma.purchaseItem.update({
        where: { id: req.params.itemId },
        data,
      });

      // Recalculate purchase total amount
      const allItems = await prisma.purchaseItem.findMany({ where: { purchaseId: req.params.id } });
      const totalAmount = allItems.reduce((sum, it) => sum + Number(it.subtotal), 0);
      console.log('DEBUG OCR UPDATE: id =', req.params.id, 'totalAmount =', totalAmount, 'allItems =', JSON.stringify(allItems));

      // Check if any items still need verification
      const anyUnmatched = allItems.some((i) => i.needsVerification || !i.productId);

      await prisma.purchase.update({
        where: { id: req.params.id },
        data: {
          totalAmount,
          status: anyUnmatched ? 'NEEDS_VERIFICATION' : 'VERIFIED',
        },
      });

      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/purchases/:id/items/:itemId — delete a line item from the purchase before posting.
router.delete('/:id/items/:itemId', authorize('OWNER', 'GUDANG'), async (req, res, next) => {
  try {
    const item = await prisma.purchaseItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });

    await prisma.purchaseItem.delete({ where: { id: req.params.itemId } });

    // Recalculate purchase total amount
    const allItems = await prisma.purchaseItem.findMany({ where: { purchaseId: req.params.id } });
    const totalAmount = allItems.reduce((sum, it) => sum + Number(it.subtotal), 0);

    const anyUnmatched = allItems.some((i) => i.needsVerification || !i.productId);

    await prisma.purchase.update({
      where: { id: req.params.id },
      data: {
        totalAmount,
        status: allItems.length === 0 ? 'VERIFIED' : (anyUnmatched ? 'NEEDS_VERIFICATION' : 'VERIFIED'),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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
