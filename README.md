# API Potensi Desa Bendungan

REST API (Express.js + PostgreSQL) untuk **Platform Web Interaktif Informasi dan Pemetaan Potensi Desa Bendungan**,
Kecamatan Gondang, Kabupaten Tulungagung.
. Dibuat mengikuti proposal Studi Independen (Bab 3.2.2, 3.2.6, 3.2.8).

> **Baru mulai? Buka `PANDUAN-MULAI-CEPAT.md`** untuk langkah demi langkah (Windows) dari nol sampai API berjalan.

## Kesesuaian dengan proposal

| Proposal | Di API ini |
|---|---|
| ERD 4 entitas (Tabel 1): ADMIN, KATEGORI_POTENSI, POTENSI_DESA, FOTO_POTENSI | 4 tabel dengan **nama kolom yang sama** (`db/schema.sql`) |
| Potensi Desa, Detail Potensi, Pencarian dan Filter | `GET /potensi`, `GET /potensi/:id_potensi` dengan `q`, `kategori`, `page`, `limit` |
| Peta Interaktif (Leaflet, latitude dan longitude) | `GET /potensi/peta` mengembalikan **GeoJSON** siap dipakai Leaflet |
| Admin: login, tambah/ubah/hapus potensi, kategori, foto, koordinat | `POST /auth/login` + endpoint POST/PUT/DELETE bertoken |
| HTML, CSS, JavaScript di front-end; API antara front-end dan back-end | JSON REST + CORS; tidak mengikat framework front-end |

**Dua keputusan yang belum ditentukan proposal dan saya isi dengan nilai awal (mohon dicek):**
1. Kolom `POTENSI_DESA.status` memakai nilai **`draft`** (belum tampil publik) dan **`terbit`** (tampil publik). Ubah di
   `db/schema.sql` (constraint `potensi_status_check`) dan `src/middleware/validate.js` (`STATUS`) bila ditentukan lain.
2. ERD hanya punya satu kolom `kontak`. Tombol WhatsApp dibentuk dari nilai `kontak` (`whatsapp_link`, null bila bukan nomor telepon). Tidak ada kolom baru.

## Status pengujian

- 43 tes integrasi lulus terhadap **PostgreSQL 16.2 asli** (bukan mock), Node.js 22.
- Dicoba juga end-to-end: `db:reset`, `admin:create`, server berjalan, curl ke endpoint utama.
- Tes diperiksa dengan merusak kode secara sengaja (menghapus pengecekan admin, membocorkan draft); keduanya tertangkap.
- **Belum diuji:** deployment publik, beban tinggi, dan integrasi dengan front-end Leaflet.

## Endpoint

| Method | Endpoint | Akses | Fungsi | Alur |
|---|---|---|---|---|
| GET | `/health` | publik | Cek server dan database | - |
| POST | `/auth/login` | publik | Login admin, mengembalikan token JWT | UF02 langkah 1 |
| GET | `/auth/me` | admin | Data admin yang sedang login | - |
| GET | `/kategori` | publik | Daftar kategori + `jumlah_potensi` terbit | UF01 langkah 3 |
| POST / PUT / DELETE | `/kategori`, `/kategori/:id_kategori` | admin | Kelola kategori (hapus ditolak 409 bila masih dipakai) | UF02 |
| GET | `/potensi` | publik | Daftar potensi **terbit**; `q`, `kategori` (nama atau id), `page`, `limit` | UF01 langkah 2 sampai 4 |
| GET | `/potensi/peta` | publik | GeoJSON potensi terbit yang punya koordinat; `kategori` opsional | Peta Interaktif |
| GET | `/potensi/:id_potensi` | publik | Detail + kategori + daftar foto (draft: 404) | UF01 langkah 5 dan 6 |
| POST | `/potensi` | admin | Tambah potensi (boleh sertakan `foto: [...]`); status awal `draft` | UF02 langkah 5 dan 6 |
| PUT | `/potensi/:id_potensi` | admin | Ubah data atau `status`; `updated_at` otomatis diperbarui | UF02 |
| DELETE | `/potensi/:id_potensi` | admin | Hapus potensi beserta fotonya | UF02 |
| POST | `/potensi/:id_potensi/foto` | admin | Tambah foto (`url_foto`, `caption`) | UF02 |
| PUT / DELETE | `/foto/:id_foto` | admin | Ubah caption/url atau hapus foto | UF02 |

Admin memakai header `Authorization: Bearer <token>`. Dengan token, `GET /potensi` juga dapat melihat `status=draft` dan kolom `id_admin`.
Token salah atau kedaluwarsa selalu dijawab 401.

### Contoh

```bash
# Login (token ada di data.token)
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@contoh.com","password":"KATASANDI_ANDA"}'

# Tambah potensi (admin). Koordinat boleh dikosongkan, tetapi latitude dan longitude harus berpasangan.
curl -X POST http://localhost:3000/potensi -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"id_kategori":2,"nama_potensi":"Warung Contoh","alamat":"Dusun Contoh","latitude":-8.0661,"longitude":111.9012,"kontak":"0812 3456 7890","status":"terbit"}'

# Pengunjung: cari dan filter
curl "http://localhost:3000/potensi?q=warung&kategori=kuliner"

# Peta (untuk Leaflet: L.geoJSON(data))
curl "http://localhost:3000/potensi/peta"
```

Contoh pemakaian di front-end (JavaScript murni + Leaflet):

```js
fetch('http://localhost:3000/potensi/peta')
  .then(r => r.json())
  .then(geojson => L.geoJSON(geojson, {
    onEachFeature: (f, layer) => layer.bindPopup(`<b>${f.properties.nama_potensi}</b><br>${f.properties.alamat || ''}`)
  }).addTo(map));
```

### Format respons dan kode status

```json
{ "success": true, "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 3, "total_pages": 1 } }
{ "success": false, "message": "Data tidak valid.", "errors": [ { "field": "latitude", "message": "..." } ] }
```

| Kode | Arti |
|---|---|
| 200 / 201 | Berhasil / berhasil dibuat |
| 400 | Data atau ID tidak valid, atau JSON rusak |
| 401 | Belum login, atau token tidak valid atau kedaluwarsa |
| 404 | Data atau rute tidak ditemukan |
| 409 | Nilai unik sudah ada (nama kategori, email) atau data masih dipakai |
| 429 | Terlalu banyak permintaan (rate limit; login lebih ketat) |

## Struktur proyek

```
db/schema.sql           Skema 4 tabel sesuai ERD proposal (+ constraint dan index)
db/seed.sql             Kategori awal dan potensi SIMULASI
scripts/init-db.js      Membuat tabel dan data simulasi (tanpa psql)
scripts/create-admin.js Membuat akun admin (kata sandi disimpan sebagai hash scrypt)
src/app.js              Aplikasi Express (helmet, cors, rate limit)
src/routes/             Daftar rute
src/controllers/        Logika endpoint (query berparameter)
src/middleware/         Autentikasi JWT, validasi, penanganan error
test/api.test.js        43 tes integrasi
postman/                Koleksi Postman (20 request bertes)
```

## Keamanan dan batasan

- Semua query berparameter (`$1`, `$2`, ...); upaya SQL injection diuji.
- Kata sandi admin disimpan sebagai **hash scrypt**, tidak pernah dikembalikan oleh API. Tidak ada pendaftaran admin publik; akun dibuat lewat `npm run admin:create`.
- Token JWT (HS256) berumur `JWT_EXPIRES_IN` (default 8 jam). Simpan `JWT_SECRET` di `.env`, jangan di-commit.
- Gunakan **HTTPS** di server publik karena token dikirim lewat header.
- **Data pada `db/seed.sql` adalah SIMULASI**, termasuk koordinatnya (koordinat aktual belum tersedia, proposal Bab 3.2.5). Hapus atau ganti dengan data yang dapat dipertanggungjawabkan, dan minta izin pemilik usaha sebelum menayangkan kontaknya.
- `url_foto` hanya menyimpan alamat gambar (URL atau path); belum ada fitur unggah berkas.
- Modul dashboard analitik anggota tim kedua (proposal Bab 3.2.7) tidak termasuk; API ini dapat menjadi sumber datanya.
