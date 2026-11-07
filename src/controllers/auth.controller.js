const jwt = require('jsonwebtoken');
const { verifyPassword, hashPassword } = require('../utils/password');

function makeAuthController(pool, config) {
  // Hash palsu agar waktu respons login tidak membocorkan apakah email terdaftar.
  const dummy = hashPassword('kata-sandi-palsu-untuk-penyeimbang-waktu');
  return {
    async login(req, res, next) {
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const errors = [];
        if (!email) errors.push({ field: 'email', message: 'Wajib diisi.' });
        if (!password) errors.push({ field: 'password', message: 'Wajib diisi.' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });

        const { rows } = await pool.query('SELECT id_admin, nama, email, password FROM admin WHERE email = $1', [email]);
        const admin = rows[0];
        const ok = await verifyPassword(password, admin ? admin.password : await dummy);
        if (!admin || !ok) return res.status(401).json({ success: false, message: 'Email atau password salah.' });

        const token = jwt.sign({ sub: admin.id_admin, email: admin.email }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });
        res.json({ success: true, message: 'Login berhasil.', data: {
          token, token_type: 'Bearer', expires_in: config.jwtExpiresIn,
          admin: { id_admin: admin.id_admin, nama: admin.nama, email: admin.email },
        } });
      } catch (e) { next(e); }
    },

    async me(req, res, next) {
      try {
        const { rows } = await pool.query('SELECT id_admin, nama, email, created_at FROM admin WHERE id_admin = $1', [req.admin.id_admin]);
        if (!rows[0]) return res.status(401).json({ success: false, message: 'Akun admin tidak ditemukan.' });
        res.json({ success: true, data: rows[0] });
      } catch (e) { next(e); }
    },
  };
}
module.exports = { makeAuthController };
