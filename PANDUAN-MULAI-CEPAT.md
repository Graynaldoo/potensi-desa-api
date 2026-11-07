# Panduan Mulai Cepat (Windows)

Ikuti urutannya dari atas ke bawah. Total sekitar 30 menit untuk pertama kali.
Tiap langkah ada tulisan **Hasil yang benar** supaya kamu tahu langkahnya berhasil.

## A. Pasang alat (sekali saja)

**1. Node.js**
- Unduh versi **LTS** dari https://nodejs.org lalu instal (Next sampai selesai).
- Buka **Command Prompt** (tekan tombol Windows, ketik `cmd`, Enter), ketik `node -v`.
- Hasil yang benar: muncul nomor versi, misalnya `v22.x.x` (minimal v18).

**2. PostgreSQL** (database)
- Unduh installer dari https://www.postgresql.org/download/windows/ lalu instal.
- Saat diminta **password untuk user `postgres`**, buat yang sederhana (huruf dan angka saja, tanpa simbol) dan **catat**.
- Biarkan port `5432`. Pastikan **pgAdmin 4** ikut terpasang.

**3. Disarankan:** VS Code (https://code.visualstudio.com), Postman (https://www.postman.com/downloads), dan Git (https://git-scm.com/download/win, hanya jika mengunggah ke GitHub).

## B. Siapkan proyek

**4.** Ekstrak `potensi-desa-bendungan-api.zip` ke folder yang mudah, misalnya `C:\proyek\potensi-desa-bendungan-api`.

**5.** Buka folder itu di VS Code (**File > Open Folder**), lalu buka terminal (**Terminal > New Terminal**).
Tanpa VS Code: di Command Prompt ketik `cd C:\proyek\potensi-desa-bendungan-api`.

**6.** Ketik: `npm install`
- Hasil yang benar: muncul `added ... packages` dan folder `node_modules`.

## C. Siapkan database dan akun admin

**7. Buat database kosong di pgAdmin**
- Buka **pgAdmin 4**, masukkan password dari langkah 2.
- Klik kanan **Databases** > **Create** > **Database...**, isi nama `potensi_desa`, klik **Save**.

**8. Buat file pengaturan `.env`**
- Di terminal ketik: `copy .env.example .env`
- Buat teks acak untuk `JWT_SECRET`: ketik `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` lalu salin hasilnya.
- Buka `.env` di VS Code dan ubah dua baris:
  ```
  DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@localhost:5432/potensi_desa
  JWT_SECRET=tempel-teks-acak-dari-perintah-di-atas
  ```
  Ganti `PASSWORD_ANDA` dengan password PostgreSQL. Simpan (Ctrl+S).

**9. Buat tabel dan data contoh:** `npm run db:init`
- Hasil yang benar:
  ```
  Skema dibuat (admin, kategori_potensi, potensi_desa, foto_potensi).
  Data simulasi dimasukkan.
  ```

**10. Buat akun admin** (ganti email dan kata sandi sesukamu; kata sandi minimal 8 karakter):
```
npm run admin:create -- "Admin Desa" admin@contoh.com KataSandi123
```
- Hasil yang benar: `Admin dibuat: { id_admin: 1, ... }`. **Catat email dan kata sandinya**, dipakai untuk login.

## D. Jalankan API

**11.** Ketik: `npm start`
- Hasil yang benar: `API berjalan di http://localhost:3000`
- **Biarkan terminal ini terbuka.** Menutupnya menghentikan API. Berhenti dengan `Ctrl + C`.

**12. Cek di browser**
- http://localhost:3000/health  -> `{"success":true,"status":"ok"}`
- http://localhost:3000/potensi  -> 3 potensi contoh (data simulasi)
- http://localhost:3000/potensi/peta  -> data peta format GeoJSON (2 titik contoh)
- http://localhost:3000/kategori  -> 6 kategori

## E. Uji semua endpoint dengan Postman (bukti untuk laporan)

Browser hanya bisa GET. Untuk login, POST, PUT, DELETE pakai Postman.

**13.** Postman > **Import** > pilih `postman/Potensi-Desa-API.postman_collection.json`.

**14.** Klik koleksi **Potensi Desa Bendungan API** > tab **Variables** > isi kolom **Current value**:
- `adminEmail` = email admin dari langkah 10
- `adminPassword` = kata sandi admin dari langkah 10
- `baseUrl` = `http://localhost:3000` (ubah jika memakai port lain)

Lalu **Save** (Ctrl+S).

**15.** Klik koleksi > **Run** > **Run Potensi Desa Bendungan API**.
- Hasil yang benar: 20 request berjalan berurutan dan semuanya **hijau (passed)**. Ambil **tangkapan layar** untuk Bab 3.9 laporan.

**16. Lihat isi tabel (tangkapan layar kedua):** pgAdmin > **Databases > potensi_desa > Schemas > public > Tables**. Kamu akan melihat 4 tabel: `admin`, `kategori_potensi`, `potensi_desa`, `foto_potensi`. Klik kanan tabel > **View/Edit Data > All Rows**.

## F. Dipakai dari front-end HTML, CSS, JavaScript

Dari halaman web kamu (misalnya `index.html`), ambil data dengan `fetch`:
```js
fetch('http://localhost:3000/potensi')
  .then(r => r.json())
  .then(hasil => console.log(hasil.data));
```
Untuk peta Leaflet, gunakan `GET /potensi/peta` (contoh lengkap ada di `README.md`). Login admin dari front-end:
kirim `POST /auth/login`, simpan `data.token`, lalu sertakan header `Authorization: Bearer <token>` pada permintaan admin.

## G. Unggah ke GitHub (jika diminta)

**17.** Buat repository kosong di https://github.com/new (nama `potensi-desa-api`, **jangan** centang "Add a README").

**18.** Hentikan server (`Ctrl + C`), lalu ketik satu per satu (ganti `USERNAME`):
```
git init
git add .
git commit -m "REST API Potensi Desa Bendungan"
git branch -M main
git remote add origin https://github.com/USERNAME/potensi-desa-api.git
git push -u origin main
```
**19. Periksa:** di GitHub **tidak boleh ada file `.env`** (berisi password dan kunci rahasia). File ini sudah otomatis diabaikan lewat `.gitignore`.

## Kalau ada masalah

| Pesan atau kejadian | Penyebab dan solusi |
|---|---|
| `'npm' is not recognized` | Node.js belum terpasang, atau terminal dibuka sebelum instalasi. Tutup dan buka terminal baru. |
| `password authentication failed` | Password di `DATABASE_URL` salah. Samakan dengan password PostgreSQL. |
| `database "potensi_desa" does not exist` | Langkah 7 belum dilakukan atau namanya salah ketik. |
| `ECONNREFUSED` atau `connect ... 5432` | PostgreSQL belum berjalan. Tekan Windows, ketik `Services`, cari `postgresql-x64-...`, klik **Start**. |
| `JWT_SECRET wajib diisi minimal 32 karakter` | Isi `JWT_SECRET` di `.env` dengan hasil perintah pada langkah 8. |
| `Tabel admin belum ada` | Jalankan `npm run db:init` (langkah 9) dulu, baru buat admin. |
| `Email sudah terdaftar` | Admin dengan email itu sudah ada. Pakai email lain, atau login dengan yang sudah ada. |
| `address already in use :3000` | Port dipakai program lain. Ubah di `.env` menjadi `PORT=3001`, lalu `npm start` lagi (dan ubah `baseUrl` di Postman). |
| Postman: 401 pada request admin | `adminEmail` atau `adminPassword` di Variables salah, atau request 02 (login) belum dijalankan lebih dulu. |
| Terlalu banyak login gagal (429) | Tunggu sebentar; login dibatasi 10 percobaan per menit. |
| Habis mengubah kode, tidak ada efek | Hentikan server (`Ctrl + C`) lalu `npm start` lagi, atau pakai `npm run dev`. |
| Ingin mengulang dari awal | `npm run db:reset` (menghapus semua tabel **termasuk akun admin**, lalu mengisi ulang data contoh). Buat admin lagi dengan langkah 10. |

## Catatan penting

- Data di `db/seed.sql` adalah **data simulasi**, termasuk koordinatnya. Ganti dengan data asli yang dapat dipertanggungjawabkan dan minta izin pemilik usaha sebelum dipublikasikan.
- Nilai kolom `status` (`draft` dan `terbit`) adalah pilihan awal karena proposal belum menentukannya; ubah bila diperlukan (lihat `README.md`).
