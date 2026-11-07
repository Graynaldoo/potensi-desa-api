const jwt = require('jsonwebtoken');

// Membaca header "Authorization: Bearer <token>" bila ada.
// - tanpa header      -> req.admin = null (pengunjung publik)
// - token valid       -> req.admin = { id_admin, email }
// - token salah/habis -> 401 (tidak diam-diam dianggap publik)
function authenticate(secret) {
  return (req, res, next) => {
    const header = req.get('authorization');
    if (!header) { req.admin = null; return next(); }
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) return res.status(401).json({ success: false, message: 'Format header Authorization harus: Bearer <token>.' });
    try {
      const payload = jwt.verify(m[1], secret, { algorithms: ['HS256'] });
      req.admin = { id_admin: Number(payload.sub), email: payload.email };
      next();
    } catch (e) {
      res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa. Silakan login ulang.' });
    }
  };
}

function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ success: false, message: 'Endpoint ini khusus admin. Login dulu lewat POST /auth/login.' });
  }
  next();
}
module.exports = { authenticate, requireAdmin };
