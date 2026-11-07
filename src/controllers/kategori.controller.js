const { validateKategori } = require('../middleware/validate');

function makeKategoriController(pool) {
  return {
    // GET /kategori  (publik). jumlah_potensi = jumlah potensi berstatus terbit.
    async list(req, res, next) {
      try {
        const { rows } = await pool.query(
          `SELECT k.id_kategori, k.nama_kategori, k.deskripsi, k.icon, k.created_at,
                  COUNT(p.id_potensi)::int AS jumlah_potensi
             FROM kategori_potensi k
             LEFT JOIN potensi_desa p ON p.id_kategori = k.id_kategori AND p.status = 'terbit'
            GROUP BY k.id_kategori ORDER BY k.nama_kategori`);
        res.json({ success: true, data: rows });
      } catch (e) { next(e); }
    },

    async create(req, res, next) {
      try {
        const { errors, data } = validateKategori(req.body, { mode: 'create' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
        const { rows } = await pool.query(
          `INSERT INTO kategori_potensi (nama_kategori, deskripsi, icon) VALUES ($1,$2,$3)
           RETURNING id_kategori, nama_kategori, deskripsi, icon, created_at`,
          [data.nama_kategori, data.deskripsi ?? null, data.icon ?? null]);
        res.status(201).location(`/kategori/${rows[0].id_kategori}`).json({ success: true, message: 'Kategori berhasil dibuat.', data: rows[0] });
      } catch (e) { next(e); }
    },

    async update(req, res, next) {
      try {
        const { errors, data } = validateKategori(req.body, { mode: 'update' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
        const sets = []; const params = [];
        for (const [k, v] of Object.entries(data)) { params.push(v); sets.push(`${k} = $${params.length}`); }
        params.push(req.ids.id_kategori);
        const { rows } = await pool.query(
          `UPDATE kategori_potensi SET ${sets.join(', ')} WHERE id_kategori = $${params.length}
           RETURNING id_kategori, nama_kategori, deskripsi, icon, created_at`, params);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
        res.json({ success: true, message: 'Kategori berhasil diperbarui.', data: rows[0] });
      } catch (e) { next(e); }
    },

    async remove(req, res, next) {
      try {
        const { rows } = await pool.query('DELETE FROM kategori_potensi WHERE id_kategori = $1 RETURNING id_kategori, nama_kategori', [req.ids.id_kategori]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
        res.json({ success: true, message: 'Kategori berhasil dihapus.', data: rows[0] });
      } catch (e) { next(e); }
    },
  };
}
module.exports = { makeKategoriController };
