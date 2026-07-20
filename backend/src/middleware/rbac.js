/**
 * Role-based access control.
 *
 * Role capability matrix (enforced here, not just in the UI):
 *   OWNER    -> full access to every module
 *   MANAGER  -> read reports, read stock/inventory, read dashboard (no destructive actions)
 *   KASIR    -> POS/sales transactions only
 *   GUDANG   -> stock/inventory management only (in, out, adjustments)
 *
 * Usage: router.post('/products', authenticate, authorize('OWNER'), handler)
 *        router.get('/reports', authenticate, authorize('OWNER', 'MANAGER'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Anda tidak memiliki izin untuk mengakses resource ini.',
      });
    }
    next();
  };
}

module.exports = { authorize };
