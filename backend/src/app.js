const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const purchasesRoutes = require('./routes/purchases.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const salesRoutes = require('./routes/sales.routes');
const reportsRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const usersRoutes = require('./routes/users.routes');
const masterDataRoutes = require('./routes/masterData.routes');

const { AppError } = require('./utils/AppError');

const app = express();

// Trust proxy so req.ip is correct behind nginx/Caddy (needed for rate limiting).
app.set('trust proxy', 1);

// --- Security headers ---
app.use(helmet());

// --- CORS: restrict to the known frontend origin(s) only ---
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// General throttle on all API traffic; /auth/login has its own tighter limiter.
app.use('/api', apiLimiter);

// --- Health check (no auth — used by load balancers) ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Routes (every one of these requires authentication internally) ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', masterDataRoutes); // /api/categories, /api/suppliers

// --- 404 ---
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// --- Central error handler ---
// AppError instances are safe to expose to the client because they are
// deliberately thrown by application code with a curated message.
// All other errors (DB failures, third-party API errors, etc.) are hidden
// behind a generic message in production to avoid leaking internals.
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi administrator.'
      : err.message,
  });
});

module.exports = app;
