const STATUS = ['draft', 'terbit'];
const isObj = (b) => b && typeof b === 'object' && !Array.isArray(b);

function text(b, f, errors, out, { max, required = false, nullable = true } = {}) {
  if (b[f] === undefined) return;
  if (b[f] === null) {
    if (required || !nullable) errors.push({ field: f, message: 'Tidak boleh kosong.' }); else out[f] = null;
    return;
  }
  if (typeof b[f] !== 'string') { errors.push({ field: f, message: 'Harus berupa teks.' }); return; }
  const v = b[f].trim();
  if (v === '') { if (required) errors.push({ field: f, message: 'Tidak boleh kosong.' }); else out[f] = null; return; }
  if (max && v.length > max) { errors.push({ field: f, message: `Maksimal ${max} karakter.` }); return; }
  out[f] = v;
}

function fotoUrl(v) { return typeof v === 'string' && v.length <= 255 && /^(https?:\/\/\S+|\/[\w\-./%]+)$/i.test(v.trim()); }

function validateFotoItem(item, errors, prefix = '') {
  if (!isObj(item)) { errors.push({ field: `${prefix}foto`, message: 'Setiap foto harus berupa objek {url_foto, caption}.' }); return null; }
  const out = {};
  if (!fotoUrl(item.url_foto)) errors.push({ field: `${prefix}url_foto`, message: 'url_foto wajib berupa URL http(s) atau path yang diawali /, maksimal 255 karakter.' });
  else out.url_foto = item.url_foto.trim();
  text(item, 'caption', errors, out, { max: 200 });
  return out;
}

function validatePotensi(body, { mode }) {
  const errors = []; const out = {};
  if (!isObj(body)) return { errors: [{ field: 'body', message: 'Body harus berupa objek JSON.' }], data: {} };
  const b = body;

  if (b.id_kategori !== undefined) {
    const n = Number(b.id_kategori);
    if (!Number.isInteger(n) || n <= 0 || n > 2147483647) errors.push({ field: 'id_kategori', message: 'Harus berupa bilangan bulat positif.' });
    else out.id_kategori = n;
  }
  text(b, 'nama_potensi', errors, out, { max: 150, required: true });
  text(b, 'deskripsi', errors, out, {});
  text(b, 'alamat', errors, out, { max: 255 });
  text(b, 'kontak', errors, out, { max: 30 });

  for (const [f, lo, hi] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
    if (b[f] === undefined) continue;
    if (b[f] === null || b[f] === '') { out[f] = null; continue; }
    const n = typeof b[f] === 'number' ? b[f] : (typeof b[f] === 'string' && b[f].trim() !== '' ? Number(b[f]) : NaN);
    if (!Number.isFinite(n) || n < lo || n > hi) errors.push({ field: f, message: `Harus berupa angka antara ${lo} dan ${hi}.` });
    else out[f] = Math.round(n * 1e6) / 1e6;
  }
  if (mode === 'create' && ((out.latitude == null) !== (out.longitude == null)) && !errors.some((e) => e.field === 'latitude' || e.field === 'longitude')) {
    errors.push({ field: 'latitude', message: 'latitude dan longitude harus diisi bersamaan (atau dikosongkan bersamaan).' });
  }

  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) errors.push({ field: 'status', message: `Harus salah satu dari: ${STATUS.join(', ')}.` });
    else out.status = b.status;
  }

  if (mode === 'create') {
    for (const f of ['id_kategori', 'nama_potensi']) if (b[f] === undefined) errors.push({ field: f, message: 'Wajib diisi.' });
    if (b.foto !== undefined) {
      if (!Array.isArray(b.foto) || b.foto.length > 10) errors.push({ field: 'foto', message: 'foto harus berupa array maksimal 10 item.' });
      else {
        out.foto = [];
        b.foto.forEach((it, i) => { const f = validateFotoItem(it, errors, `foto[${i}].`); if (f) out.foto.push(f); });
      }
    }
  }
  const keys = Object.keys(out).filter((k) => k !== 'foto');
  if (mode === 'update' && keys.length === 0 && errors.length === 0) errors.push({ field: 'body', message: 'Tidak ada field yang dapat diubah.' });
  return { errors, data: out };
}

function validateKategori(body, { mode }) {
  const errors = []; const out = {};
  if (!isObj(body)) return { errors: [{ field: 'body', message: 'Body harus berupa objek JSON.' }], data: {} };
  text(body, 'nama_kategori', errors, out, { max: 80, required: true });
  text(body, 'deskripsi', errors, out, {});
  text(body, 'icon', errors, out, { max: 100 });
  if (mode === 'create' && body.nama_kategori === undefined) errors.push({ field: 'nama_kategori', message: 'Wajib diisi.' });
  if (mode === 'update' && Object.keys(out).length === 0 && errors.length === 0) errors.push({ field: 'body', message: 'Tidak ada field yang dapat diubah.' });
  return { errors, data: out };
}

function validateFoto(body, { mode }) {
  if (!isObj(body)) return { errors: [{ field: 'body', message: 'Body harus berupa objek JSON.' }], data: {} };
  const errors = []; const out = {};
  if (mode === 'create') { const d = validateFotoItem(body, errors); return { errors, data: d || {} }; }
  if (body.url_foto !== undefined) {
    if (!fotoUrl(body.url_foto)) errors.push({ field: 'url_foto', message: 'url_foto wajib berupa URL http(s) atau path yang diawali /, maksimal 255 karakter.' });
    else out.url_foto = body.url_foto.trim();
  }
  text(body, 'caption', errors, out, { max: 200 });
  if (Object.keys(out).length === 0 && errors.length === 0) errors.push({ field: 'body', message: 'Tidak ada field yang dapat diubah.' });
  return { errors, data: out };
}

function parseId(param) {
  return (req, res, next) => {
    const id = Number(req.params[param]);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ success: false, message: `${param} harus berupa bilangan bulat positif.` });
    }
    req.ids = { ...(req.ids || {}), [param]: id };
    next();
  };
}
module.exports = { validatePotensi, validateKategori, validateFoto, parseId, STATUS };
