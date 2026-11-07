-- DATA SIMULASI untuk pengujian dan demo. BUKAN data potensi nyata Desa Bendungan.
-- Nama, deskripsi, kontak, dan KOORDINAT di bawah ini fiktif (koordinat aktual desa belum tersedia).
-- Hapus atau ganti dengan data asli yang dapat dipertanggungjawabkan, dan minta izin pemilik usaha,
-- sebelum website dipublikasikan.

INSERT INTO kategori_potensi (nama_kategori, deskripsi, icon) VALUES
('Wisata', 'Tempat wisata dan daya tarik desa', 'map-pin'),
('Kuliner', 'Usaha makanan dan minuman', 'utensils'),
('Kerajinan', 'Produk kerajinan dan ekonomi kreatif', 'palette'),
('Toko dan Jasa', 'Toko, warung, dan usaha jasa', 'store'),
('Pertanian', 'Hasil dan lahan pertanian', 'sprout'),
('Fasilitas Umum', 'Balai desa, sekolah, dan fasilitas lain', 'building')
ON CONFLICT (nama_kategori) DO NOTHING;

INSERT INTO potensi_desa (id_kategori, nama_potensi, deskripsi, alamat, latitude, longitude, kontak, status)
SELECT k.id_kategori, v.nama, v.deskripsi, v.alamat, v.lat, v.lng, v.kontak, v.status
FROM (VALUES
  ('Kuliner',   '[CONTOH] Lauk Rumahan A',        'Data simulasi: aneka lauk siap makan.',              'Dusun Contoh 1', -8.065000, 111.900000, '081200000001', 'terbit'),
  ('Kerajinan', '[CONTOH] Kerajinan Anyaman B',   'Data simulasi: keranjang dan tikar anyaman bambu.',  'Dusun Contoh 2', -8.067000, 111.903000, '081200000002', 'terbit'),
  ('Toko dan Jasa', '[CONTOH] Toko Kelontong C',  'Data simulasi: kebutuhan harian dan sembako.',       'Dusun Contoh 3', NULL::numeric, NULL::numeric, '081200000003', 'terbit'),
  ('Wisata',    '[CONTOH] Wisata Sawah D',        'Data simulasi: masih draft, belum tampil di publik.', 'Dusun Contoh 1', -8.069000, 111.905000, NULL, 'draft')
) AS v(kategori, nama, deskripsi, alamat, lat, lng, kontak, status)
JOIN kategori_potensi k ON k.nama_kategori = v.kategori
WHERE NOT EXISTS (SELECT 1 FROM potensi_desa p WHERE p.nama_potensi = v.nama);
