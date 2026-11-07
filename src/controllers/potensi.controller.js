const { validatePotensi, validateFoto, STATUS } = require('../middleware/validate');
const { waLink } = require('../utils/whatsapp');

const colsPublic = `p.id_potensi, p.id_kategori, k.nama_kategori, k.icon AS kategori_icon, p.nama_potensi, p.deskripsi,
  p.alamat, p.latitude, p.longitude, p.kontak, p.status, p.created_at, p.updated_at`;
const colsAdmin = `${colsPublic}, p.id_admin`;
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const present = (r) => ({ ...r, whatsapp_link: waLink(r.kontak, r.nama_potensi) });

function makePotensiController(pool) {
  async function loadDetail(id, isAdmin) {
    const { rows } = await pool.query(
      `SELECT ${isAdmin ? colsAdmin : colsPublic} FROM potensi_desa p JOIN kategori_potensi k ON k.id_kategori = p.id_kategori
        WHERE p.id_potensi = $1 ${isAdmin ? '' : `AND p.status = 'terbit'`}`, [id]);
    if (!rows[0]) return null;
    const foto = (await pool.query(
      'SELECT id_foto, url_foto, caption, created_at FROM foto_potensi WHERE id_potensi = $1 ORDER BY id_foto', [id])).rows;
    return { ...present(rows[0]), foto };
  }

  function buildFilters(req, params) {
    const where = []; const add = (v) => { params.push(v); return `$${params.length}`; };
    if (req.admin) {
      if (req.query.status !== undefined) {
        if (!STATUS.includes(req.query.status)) return { error: `status harus salah satu dari: ${STATUS.join(', ')}.` };
        where.push(`p.status = ${add(req.query.status)}`);
      }
    } else where.push(`p.status = 'terbit'`);
    if (typeof req.query.kategori === 'string' && req.query.kategori.trim()) {
      const k = req.query.kategori.trim();
      where.push(/^\d{1,9}$/.test(k) ? `p.id_kategori = ${add(Number(k))}` : `LOWER(k.nama_kategori) = ${add(k.toLowerCase())}`);
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const ph = add(`%${escapeLike(req.query.q.trim())}%`);
      where.push(`(p.nama_potensi ILIKE ${ph} OR p.deskripsi ILIKE ${ph} OR p.alamat ILIKE ${ph})`);
    }
    return { where };
  }

  return {
    // GET /potensi  (UF01 langkah 2 sampai 4)
    async list(req, res, next) {
      try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const params = [];
        const f = buildFilters(req, params);
        if (f.error) return res.status(400).json({ success: false, message: f.error });
        const whereSql = f.where.length ? `WHERE ${f.where.join(' AND ')}` : '';
        const from = 'FROM potensi_desa p JOIN kategori_potensi k ON k.id_kategori = p.id_kategori';
        const total = Number((await pool.query(`SELECT COUNT(*) ${from} ${whereSql}`, params)).rows[0].count);
        params.push(limit, (page - 1) * limit);
        const rows = (await pool.query(
          `SELECT ${req.admin ? colsAdmin : colsPublic},
                  (SELECT url_foto FROM foto_potensi f WHERE f.id_potensi = p.id_potensi ORDER BY f.id_foto LIMIT 1) AS foto_utama
             ${from} ${whereSql} ORDER BY p.updated_at DESC, p.id_potensi DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
        res.json({ success: true, data: rows.map(present), meta: { page, limit, total, total_pages: Math.max(Math.ceil(total / limit), 1) } });
      } catch (e) { next(e); }
    },

    // GET /potensi/peta  -> GeoJSON FeatureCollection untuk Leaflet (hanya yang terbit dan punya koordinat)
    async geojson(req, res, next) {
      try {
        const params = []; const where = [`p.status = 'terbit'`, 'p.latitude IS NOT NULL'];
        if (typeof req.query.kategori === 'string' && req.query.kategori.trim()) {
          const k = req.query.kategori.trim(); params.push(/^\d{1,9}$/.test(k) ? Number(k) : k.toLowerCase());
          where.push(/^\d{1,9}$/.test(k) ? `p.id_kategori = $1` : `LOWER(k.nama_kategori) = $1`);
        }
        const { rows } = await pool.query(
          `SELECT p.id_potensi, p.nama_potensi, p.alamat, p.kontak, p.latitude, p.longitude, k.id_kategori, k.nama_kategori, k.icon AS kategori_icon,
                  (SELECT url_foto FROM foto_potensi f WHERE f.id_potensi = p.id_potensi ORDER BY f.id_foto LIMIT 1) AS foto_utama
             FROM potensi_desa p JOIN kategori_potensi k ON k.id_kategori = p.id_kategori
            WHERE ${where.join(' AND ')} ORDER BY p.id_potensi`, params);
        res.json({ type: 'FeatureCollection', features: rows.map((r) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },   // GeoJSON: [lng, lat]
          properties: { id_potensi: r.id_potensi, nama_potensi: r.nama_potensi, alamat: r.alamat, kontak: r.kontak,
            id_kategori: r.id_kategori, nama_kategori: r.nama_kategori, kategori_icon: r.kategori_icon, foto_utama: r.foto_utama },
        })) });
      } catch (e) { next(e); }
    },

    // GET /potensi/:id_potensi  (UF01 langkah 5 dan 6)
    async getOne(req, res, next) {
      try {
        const d = await loadDetail(req.ids.id_potensi, !!req.admin);
        if (!d) return res.status(404).json({ success: false, message: 'Potensi tidak ditemukan.' });
        res.json({ success: true, data: d });
      } catch (e) { next(e); }
    },

    // POST /potensi  (admin; UF02 langkah 5 dan 6) boleh menyertakan foto: [{url_foto, caption}]
    async create(req, res, next) {
      const { errors, data } = validatePotensi(req.body, { mode: 'create' });
      if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ins = await client.query(
          `INSERT INTO potensi_desa (id_kategori, id_admin, nama_potensi, deskripsi, alamat, latitude, longitude, kontak, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_potensi`,
          [data.id_kategori, req.admin.id_admin, data.nama_potensi, data.deskripsi ?? null, data.alamat ?? null,
           data.latitude ?? null, data.longitude ?? null, data.kontak ?? null, data.status ?? 'draft']);
        const id = ins.rows[0].id_potensi;
        for (const f of data.foto || []) {
          await client.query('INSERT INTO foto_potensi (id_potensi, url_foto, caption) VALUES ($1,$2,$3)', [id, f.url_foto, f.caption ?? null]);
        }
        await client.query('COMMIT');
        res.status(201).location(`/potensi/${id}`).json({ success: true, message: 'Potensi berhasil ditambahkan.', data: await loadDetail(id, true) });
      } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e); }
      finally { client.release(); }
    },

    // PUT /potensi/:id_potensi  (admin; memperbarui field yang dikirim)
    async update(req, res, next) {
      try {
        const { errors, data } = validatePotensi(req.body, { mode: 'update' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
        const cur = (await pool.query('SELECT latitude, longitude FROM potensi_desa WHERE id_potensi = $1', [req.ids.id_potensi])).rows[0];
        if (!cur) return res.status(404).json({ success: false, message: 'Potensi tidak ditemukan.' });
        const lat = 'latitude' in data ? data.latitude : cur.latitude;
        const lng = 'longitude' in data ? data.longitude : cur.longitude;
        if ((lat == null) !== (lng == null)) {
          return res.status(400).json({ success: false, message: 'Data tidak valid.', errors: [{ field: 'latitude', message: 'latitude dan longitude harus diisi bersamaan (atau dikosongkan bersamaan).' }] });
        }
        const sets = []; const params = [];
        for (const [k, v] of Object.entries(data)) { params.push(v); sets.push(`${k} = $${params.length}`); }
        sets.push('updated_at = now()'); params.push(req.ids.id_potensi);
        await pool.query(`UPDATE potensi_desa SET ${sets.join(', ')} WHERE id_potensi = $${params.length}`, params);
        res.json({ success: true, message: 'Potensi berhasil diperbarui.', data: await loadDetail(req.ids.id_potensi, true) });
      } catch (e) { next(e); }
    },

    // DELETE /potensi/:id_potensi  (admin; foto ikut terhapus)
    async remove(req, res, next) {
      try {
        const { rows } = await pool.query('DELETE FROM potensi_desa WHERE id_potensi = $1 RETURNING id_potensi, nama_potensi', [req.ids.id_potensi]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Potensi tidak ditemukan.' });
        res.json({ success: true, message: 'Potensi berhasil dihapus beserta fotonya.', data: rows[0] });
      } catch (e) { next(e); }
    },

    // POST /potensi/:id_potensi/foto  (admin)
    async addFoto(req, res, next) {
      try {
        const { errors, data } = validateFoto(req.body, { mode: 'create' });
        if (errors.length) return res.status(400).json({ success: false, message: 'Data tidak valid.', errors });
        const exists = await pool.query('UPDATE potensi_desa SET updated_at = now() WHERE id_potensi = $1 RETURNING id_potensi', [req.ids.id_potensi]);
        if (!exists.rows[0]) return res.status(404).json({ success: false, message: 'Potensi tidak ditemukan.' });
        const { rows } = await pool.query(
          'INSERT INTO foto_potensi (id_potensi, url_foto, caption) VALUES ($1,$2,$3) RETURNING id_foto, id_potensi, url_foto, caption, created_at',
          [req.ids.id_potensi, data.url_foto, data.caption ?? null]);
        res.status(201).json({ success: true, message: 'Foto berhasil ditambahkan.', data: rows[0] });
      } catch (e) { next(e); }
    },
  };
}
module.exports = { makePotensiController };
