const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAdmin } = require('../middleware/auth');
const { parseId } = require('../middleware/validate');
const { makeAuthController } = require('../controllers/auth.controller');
const { makeKategoriController } = require('../controllers/kategori.controller');
const { makePotensiController } = require('../controllers/potensi.controller');
const { makeFotoController } = require('../controllers/foto.controller');

function buildRoutes(pool, config) {
  const r = express.Router();
  const auth = makeAuthController(pool, config);
  const kat = makeKategoriController(pool);
  const pot = makePotensiController(pool);
  const foto = makeFotoController(pool);

  const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: config.loginRateLimitMax, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi sebentar.' } });

  // Autentikasi
  r.post('/auth/login', loginLimiter, auth.login);
  r.get('/auth/me', requireAdmin, auth.me);

  // Kategori (KATEGORI_POTENSI)
  r.get('/kategori', kat.list);
  r.post('/kategori', requireAdmin, kat.create);
  r.put('/kategori/:id_kategori', requireAdmin, parseId('id_kategori'), kat.update);
  r.delete('/kategori/:id_kategori', requireAdmin, parseId('id_kategori'), kat.remove);

  // Potensi (POTENSI_DESA). /potensi/peta harus didaftarkan sebelum /potensi/:id_potensi.
  r.get('/potensi', pot.list);
  r.get('/potensi/peta', pot.geojson);
  r.get('/potensi/:id_potensi', parseId('id_potensi'), pot.getOne);
  r.post('/potensi', requireAdmin, pot.create);
  r.put('/potensi/:id_potensi', requireAdmin, parseId('id_potensi'), pot.update);
  r.delete('/potensi/:id_potensi', requireAdmin, parseId('id_potensi'), pot.remove);

  // Foto (FOTO_POTENSI)
  r.post('/potensi/:id_potensi/foto', requireAdmin, parseId('id_potensi'), pot.addFoto);
  r.put('/foto/:id_foto', requireAdmin, parseId('id_foto'), foto.update);
  r.delete('/foto/:id_foto', requireAdmin, parseId('id_foto'), foto.remove);
  return r;
}
module.exports = { buildRoutes };
