const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10);

// Argon2id is the modern, OWASP-recommended password hashing algorithm —
// resistant to GPU cracking, memory-hard. Never store or log plain passwords.
async function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id });
}

async function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

async function signRefreshToken(user) {
  const token = uuidv4() + uuidv4(); // opaque high-entropy token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { token, userId: user.id, expiresAt },
  });
  return token;
}

/**
 * Handles login with account lockout after repeated failures — mitigates
 * brute-force attacks regardless of the IP-based rate limiter.
 */
async function attemptLogin(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });

  // Constant-shape response whether the user exists or not, to avoid
  // leaking which usernames are valid.
  const genericError = { ok: false, error: 'Username atau password salah.' };

  if (!user || !user.isActive) return genericError;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: `Akun terkunci sementara. Coba lagi setelah ${user.lockedUntil.toLocaleTimeString()}.` };
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });
    return genericError;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken(user);
  const refreshToken = await signRefreshToken(user);

  return {
    ok: true,
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  };
}

module.exports = { hashPassword, verifyPassword, signAccessToken, signRefreshToken, attemptLogin };
