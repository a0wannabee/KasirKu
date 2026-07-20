const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

/**
 * Verifies the access token on every protected route.
 * There is no endpoint in this system that skips this middleware except
 * /api/auth/login, /api/auth/refresh, and /api/health.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });
    }

    // Re-check the user still exists and is active on every request —
    // prevents a deactivated/deleted user from continuing to use an old token.
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    req.user = { id: user.id, role: user.role, username: user.username };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
