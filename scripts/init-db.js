// Membuat tabel (db/schema.sql) dan mengisi data simulasi (db/seed.sql) tanpa perlu psql.
// Pakai: npm run db:init
//        npm run db:reset            (hapus semua tabel lebih dulu, lalu buat ulang)
//        node scripts/init-db.js --no-seed   (tanpa data simulasi)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const reset = process.argv.includes('--reset');
  const noSeed = process.argv.includes('--no-seed');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL belum diisi. Salin .env.example menjadi .env terlebih dulu.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (reset) {
      await pool.query('DROP TABLE IF EXISTS foto_potensi, potensi_desa, kategori_potensi, admin CASCADE');
      console.log('Semua tabel dihapus.');
    }
    await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
    console.log('Skema dibuat (admin, kategori_potensi, potensi_desa, foto_potensi).');
    if (!noSeed) {
      await pool.query(fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8'));
      console.log('Data simulasi dimasukkan.');
    }
    console.log('Langkah berikutnya: buat akun admin dengan  npm run admin:create -- "Nama" email password');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
