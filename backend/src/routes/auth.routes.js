const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const { attemptLogin, signAccessToken, signRefreshToken } = require('../services/authService');
const { writeAuditLog } = require('../middleware/auditLog');

const router = express.Router();

// POST /api/auth/login  (public — throttled by IP and by per-account lockout)
router.post(
  '/login',
  loginLimiter,
  [body('username').trim().notEmpty(), body('password').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const result = await attemptLogin(username, password);
      if (!result.ok) return res.status(401).json({ error: result.error });

      await prisma.auditLog.create({
        data: { userId: result.user.id, action: 'LOGIN', entityType: 'User', entityId: result.user.id, ipAddress: req.ip },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh (public — requires a valid, unexpired, unrevoked refresh token)
router.post('/refresh', [body('refreshToken').notEmpty()], validate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token tidak valid.' });
    }
    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Akun tidak aktif.' });

    const accessToken = signAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout (protected — revokes the refresh token)
router.post('/logout', authenticate, [body('refreshToken').notEmpty()], validate, async (req, res, next) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { token: req.body.refreshToken, userId: req.user.id },
      data: { revoked: true },
    });
    await writeAuditLog({ req, action: 'LOGOUT', entityType: 'User', entityId: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me (protected)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, fullName: true, role: true, email: true, lastLoginAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
