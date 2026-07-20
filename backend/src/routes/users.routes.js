const express = require('express');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { writeAuditLog } = require('../middleware/auditLog');
const { hashPassword } = require('../services/authService');

const router = express.Router();
router.use(authenticate, authorize('OWNER')); // user/role management is OWNER-only, full-stop.

router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, fullName: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post(
  '/',
  [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail(),
    body('fullName').trim().notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter.'),
    body('role').isIn(['OWNER', 'MANAGER', 'KASIR', 'GUDANG']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const passwordHash = await hashPassword(req.body.password);
      const user = await prisma.user.create({
        data: {
          username: req.body.username,
          email: req.body.email,
          fullName: req.body.fullName,
          role: req.body.role,
          passwordHash,
        },
        select: { id: true, username: true, fullName: true, email: true, role: true },
      });
      await writeAuditLog({ req, action: 'USER_CREATE', entityType: 'User', entityId: user.id, after: user });
      res.status(201).json(user);
    } catch (err) { next(err); }
  }
);

router.put('/:id/role', [body('role').isIn(['OWNER', 'MANAGER', 'KASIR', 'GUDANG'])], validate, async (req, res, next) => {
  try {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const after = await prisma.user.update({ where: { id: req.params.id }, data: { role: req.body.role } });
    await writeAuditLog({ req, action: 'USER_ROLE_CHANGE', entityType: 'User', entityId: after.id, before: { role: before.role }, after: { role: after.role } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/:id/deactivate', async (req, res, next) => {
  try {
    const after = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    await writeAuditLog({ req, action: 'USER_DEACTIVATE', entityType: 'User', entityId: after.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
