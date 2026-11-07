// Membuat akun admin. Pakai:
//   npm run admin:create -- "Nama Admin" email@contoh.com KataSandiMinimal8
require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/utils/password');

async function main() {
  const [nama, email, password] = process.argv.slice(2);
  if (!nama || !email || !password) {
    console.error('Pemakaian: npm run admin:create -- "Nama Admin" email@contoh.com KataSandi');
    process.exit(1);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) { console.error('Format email tidak valid.'); process.exit(1); }
  if (password.length < 8) { console.error('Kata sandi minimal 8 karakter.'); process.exit(1); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL belum diisi di .env'); process.exit(1); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      'INSERT INTO admin (nama, email, password) VALUES ($1, $2, $3) RETURNING id_admin, nama, email',
      [nama.trim(), email.trim().toLowerCase(), await hashPassword(password)]);
    console.log('Admin dibuat:', rows[0]);
  } catch (e) {
    if (e.code === '23505') console.error('Email sudah terdaftar.');
    else if (e.code === '42P01') console.error('Tabel admin belum ada. Jalankan dulu: npm run db:init');
    else console.error('Gagal:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
main();
