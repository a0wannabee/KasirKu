const rateLimit = require('express-rate-limit');

// General API throttle — protects against abuse/DoS on every route.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan, coba lagi nanti.' },
});

// Tighter throttle specifically on /auth/login to slow down credential
// stuffing / brute force, in addition to the per-account lockout logic
// implemented in authController (failedLoginCount / lockedUntil).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});

module.exports = { apiLimiter, loginLimiter };
