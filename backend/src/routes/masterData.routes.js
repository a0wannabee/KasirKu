const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(authenticate);

// --- Categories ---
router.get('/categories', async (req, res, next) => {
  try { res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } })); } catch (err) { next(err); }
});

router.post('/categories', authorize('OWNER', 'GUDANG'), [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    const category = await prisma.category.create({ data: { name: req.body.name } });
    await writeAuditLog({ req, action: 'CATEGORY_CREATE', entityType: 'Category', entityId: category.id, after: category });
    res.status(201).json(category);
  } catch (err) { next(err); }
});

// --- Suppliers ---
router.get('/suppliers', async (req, res, next) => {
  try { res.json(await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })); } catch (err) { next(err); }
});

router.post(
  '/suppliers',
  authorize('OWNER', 'GUDANG'),
  [body('name').trim().notEmpty(), body('phone').optional().trim(), body('email').optional().isEmail()],
  validate,
  async (req, res, next) => {
    try {
      const supplier = await prisma.supplier.create({ data: req.body });
      await writeAuditLog({ req, action: 'SUPPLIER_CREATE', entityType: 'Supplier', entityId: supplier.id, after: supplier });
      res.status(201).json(supplier);
    } catch (err) { next(err); }
  }
);

module.exports = router;
