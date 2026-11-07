const { validateFoto } = require('../middleware/validate');

function makeFotoController(pool) {
  return {
    // PUT /foto/:id_foto (admin)
    async update(req, res, next) {
      try {
        const { errors, data } = validateFoto(req.body, { mode: 'update' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
        const sets = []; const params = [];
        for (const [k, v] of Object.entries(data)) { params.push(v); sets.push(`${k} = $${params.length}`); }
        params.push(req.ids.id_foto);
        const { rows } = await pool.query(
          `UPDATE foto_potensi SET ${sets.join(', ')} WHERE id_foto = $${params.length} RETURNING id_foto, id_potensi, url_foto, caption, created_at`, params);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });
        await pool.query('UPDATE potensi_desa SET updated_at = now() WHERE id_potensi = $1', [rows[0].id_potensi]);
        res.json({ success: true, message: 'Foto berhasil diperbarui.', data: rows[0] });
      } catch (e) { next(e); }
    },

    // DELETE /foto/:id_foto (admin)
    async remove(req, res, next) {
      try {
        const { rows } = await pool.query('DELETE FROM foto_potensi WHERE id_foto = $1 RETURNING id_foto, id_potensi', [req.ids.id_foto]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });
        await pool.query('UPDATE potensi_desa SET updated_at = now() WHERE id_potensi = $1', [rows[0].id_potensi]);
        res.json({ success: true, message: 'Foto berhasil dihapus.', data: rows[0] });
      } catch (e) { next(e); }
    },
  };
}
module.exports = { makeFotoController };
