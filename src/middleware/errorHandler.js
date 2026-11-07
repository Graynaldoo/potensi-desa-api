function notFound(req, res) {
  res.status(404).json({ success: false, message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body bukan JSON yang valid.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Body terlalu besar.' });
  }
  switch (err.code) {
    case '23505': return res.status(409).json({ success: false, message: 'Data dengan nilai unik yang sama sudah ada (misalnya nama kategori atau email).' });
    case '23503':
      return req.method === 'DELETE'
        ? res.status(409).json({ success: false, message: 'Data masih dipakai oleh data lain sehingga tidak dapat dihapus.' })
        : res.status(400).json({ success: false, message: 'Data rujukan tidak ditemukan (periksa id_kategori atau id_potensi).' });
    case '23514': return res.status(400).json({ success: false, message: 'Data melanggar aturan basis data (periksa status dan koordinat).' });
    case '23502': return res.status(400).json({ success: false, message: 'Ada kolom wajib yang kosong.' });
    case '22001': return res.status(400).json({ success: false, message: 'Ada teks yang melebihi panjang maksimum kolom.' });
    case '22P02': return res.status(400).json({ success: false, message: 'Format data tidak valid.' });
    default:
  }
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
}
module.exports = { notFound, errorHandler };
