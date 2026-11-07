// Tes integrasi: berjalan terhadap PostgreSQL sungguhan (bukan mock).
// Jalankan: TEST_DATABASE_URL=postgresql://... npm test
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createPool } = require('../src/db');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/utils/password');

const DB = process.env.TEST_DATABASE_URL;
const SECRET = 'rahasia-pengujian-yang-cukup-panjang-123456';
const EMAIL = 'admin@desa.test';
const PASS = 'KataSandiUji123';
let pool, server, base, token, limitedServer, limitedBase;

const api = async (method, url, { body, tok, raw, b = base } = {}) => {
  const res = await fetch(b + url, {
    method,
    headers: { ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch (e) { /* kosong */ }
  return { status: res.status, json, headers: res.headers };
};
const kat = async (nama) => (await pool.query('SELECT id_kategori FROM kategori_potensi WHERE nama_kategori = $1', [nama])).rows[0].id_kategori;
const mk = (over = {}) => ({ id_kategori: 1, nama_potensi: 'Potensi Uji', ...over });

before(async () => {
  if (!DB) throw new Error('Set TEST_DATABASE_URL untuk menjalankan tes.');
  pool = createPool(DB);
  await pool.query('DROP TABLE IF EXISTS foto_potensi, potensi_desa, kategori_potensi, admin CASCADE');
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8'));
  await pool.query('INSERT INTO admin (nama, email, password) VALUES ($1,$2,$3)', ['Admin Uji', EMAIL, await hashPassword(PASS)]);
  const cfg = { jwtSecret: SECRET, jwtExpiresIn: '1h', corsOrigin: '*', rateLimitMax: 100000, loginRateLimitMax: 100000 };
  server = createApp({ pool, config: cfg }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  limitedServer = createApp({ pool, config: { ...cfg, loginRateLimitMax: 3 } }).listen(0);
  limitedBase = `http://127.0.0.1:${limitedServer.address().port}`;
  token = (await api('POST', '/auth/login', { body: { email: EMAIL, password: PASS } })).json.data.token;
});
after(async () => { server.close(); limitedServer.close(); await pool.end(); });

describe('skema basis data sesuai ERD proposal', () => {
  test('empat tabel dengan kolom proposal', async () => {
    const q = async (t) => (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [t])).rows.map((r) => r.column_name);
    for (const c of ['id_admin', 'nama', 'email', 'password', 'created_at']) assert.ok((await q('admin')).includes(c), 'admin.' + c);
    for (const c of ['id_kategori', 'nama_kategori', 'deskripsi', 'icon', 'created_at']) assert.ok((await q('kategori_potensi')).includes(c), 'kategori.' + c);
    for (const c of ['id_potensi', 'id_kategori', 'id_admin', 'nama_potensi', 'deskripsi', 'alamat', 'latitude', 'longitude', 'kontak', 'status', 'created_at', 'updated_at']) assert.ok((await q('potensi_desa')).includes(c), 'potensi.' + c);
    for (const c of ['id_foto', 'id_potensi', 'url_foto', 'caption', 'created_at']) assert.ok((await q('foto_potensi')).includes(c), 'foto.' + c);
  });
  test('kata sandi tersimpan sebagai hash, bukan teks asli', async () => {
    const { rows } = await pool.query('SELECT password FROM admin WHERE email = $1', [EMAIL]);
    assert.match(rows[0].password, /^scrypt\$/);
    assert.ok(!rows[0].password.includes(PASS));
  });
  test('constraint basis data menolak koordinat tunggal dan status liar', async () => {
    await assert.rejects(pool.query("INSERT INTO potensi_desa (id_kategori, nama_potensi, latitude) VALUES (1,'x',-8)"), { code: '23514' });
    await assert.rejects(pool.query("INSERT INTO potensi_desa (id_kategori, nama_potensi, status) VALUES (1,'x','aktif')"), { code: '23514' });
  });
});

describe('health dan keamanan dasar', () => {
  test('GET /health -> 200', async () => { assert.equal((await api('GET', '/health')).status, 200); });
  test('rute tidak dikenal -> 404 JSON', async () => { const r = await api('GET', '/tidak-ada'); assert.equal(r.status, 404); assert.equal(r.json.success, false); });
  test('JSON rusak -> 400', async () => { assert.equal((await api('POST', '/auth/login', { raw: '{rusak' })).status, 400); });
  test('header helmet aktif, x-powered-by mati', async () => {
    const r = await api('GET', '/health');
    assert.ok(r.headers.get('x-content-type-options')); assert.equal(r.headers.get('x-powered-by'), null);
  });
});

describe('POST /auth/login dan GET /auth/me (UF02 langkah 1)', () => {
  test('kredensial benar -> 200 + token, tanpa password di respons', async () => {
    const r = await api('POST', '/auth/login', { body: { email: ' ADMIN@desa.test ', password: PASS } });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.token); assert.equal(r.json.data.token_type, 'Bearer');
    assert.equal('password' in r.json.data.admin, false);
  });
  test('password salah dan email tidak dikenal -> 401 dengan pesan sama', async () => {
    const a = await api('POST', '/auth/login', { body: { email: EMAIL, password: 'salah-salah' } });
    const b = await api('POST', '/auth/login', { body: { email: 'tidak@ada.test', password: 'apa-saja-ini' } });
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.json.message, b.json.message);
  });
  test('field kosong -> 400', async () => {
    const r = await api('POST', '/auth/login', { body: { email: '' } });
    assert.equal(r.status, 400); assert.deepEqual(r.json.errors.map((e) => e.field).sort(), ['email', 'password']);
  });
  test('/auth/me: tanpa token 401, token valid 200', async () => {
    assert.equal((await api('GET', '/auth/me')).status, 401);
    const r = await api('GET', '/auth/me', { tok: token });
    assert.equal(r.status, 200); assert.equal(r.json.data.email, EMAIL); assert.equal('password' in r.json.data, false);
  });
  test('token rusak, kedaluwarsa, atau salah rahasia -> 401', async () => {
    assert.equal((await api('GET', '/auth/me', { tok: 'bukan.token.valid' })).status, 401);
    const expired = jwt.sign({ sub: 1, email: EMAIL }, SECRET, { expiresIn: -10 });
    assert.equal((await api('GET', '/auth/me', { tok: expired })).status, 401);
    const forged = jwt.sign({ sub: 1, email: EMAIL }, 'rahasia-lain-yang-juga-panjang-1234567890');
    assert.equal((await api('GET', '/auth/me', { tok: forged })).status, 401);
  });
  test('token tidak boleh memakai algoritma none', async () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 1, email: EMAIL })).toString('base64url') + '.';
    assert.equal((await api('GET', '/auth/me', { tok: none })).status, 401);
  });
  test('rate limit login -> 429 setelah melewati batas', async () => {
    let last;
    for (let i = 0; i < 5; i++) last = await api('POST', '/auth/login', { body: { email: EMAIL, password: 'salah-salah' }, b: limitedBase });
    assert.equal(last.status, 429);
  });
});

describe('kategori (KATEGORI_POTENSI)', () => {
  test('GET /kategori publik dengan jumlah_potensi terbit', async () => {
    const r = await api('GET', '/kategori');
    assert.equal(r.status, 200); assert.ok(r.json.data.length >= 6);
    const wisata = r.json.data.find((k) => k.nama_kategori === 'Wisata');
    assert.equal(wisata.jumlah_potensi, 0);   // satu-satunya potensi wisata masih draft
    assert.equal(r.json.data.find((k) => k.nama_kategori === 'Kuliner').jumlah_potensi, 1);
  });
  test('POST tanpa token 401; dengan token 201; duplikat 409; kosong 400', async () => {
    assert.equal((await api('POST', '/kategori', { body: { nama_kategori: 'Baru' } })).status, 401);
    const ok = await api('POST', '/kategori', { body: { nama_kategori: 'Kategori Uji', icon: 'star' }, tok: token });
    assert.equal(ok.status, 201);
    assert.equal((await api('POST', '/kategori', { body: { nama_kategori: 'Kategori Uji' }, tok: token })).status, 409);
    assert.equal((await api('POST', '/kategori', { body: { deskripsi: 'x' }, tok: token })).status, 400);
  });
  test('PUT 200 / 404 / 400; DELETE tidak dipakai 200 / 404', async () => {
    const c = (await api('POST', '/kategori', { body: { nama_kategori: 'Untuk Diubah' }, tok: token })).json.data.id_kategori;
    assert.equal((await api('PUT', `/kategori/${c}`, { body: { deskripsi: 'baru' }, tok: token })).json.data.deskripsi, 'baru');
    assert.equal((await api('PUT', '/kategori/999999', { body: { deskripsi: 'x' }, tok: token })).status, 404);
    assert.equal((await api('PUT', `/kategori/${c}`, { body: {}, tok: token })).status, 400);
    assert.equal((await api('DELETE', `/kategori/${c}`, { tok: token })).status, 200);
    assert.equal((await api('DELETE', `/kategori/${c}`, { tok: token })).status, 404);
  });
  test('DELETE kategori yang masih dipakai potensi -> 409', async () => {
    assert.equal((await api('DELETE', `/kategori/${await kat('Kuliner')}`, { tok: token })).status, 409);
  });
});

describe('GET /potensi publik (UF01 langkah 2 sampai 4)', () => {
  test('hanya status terbit; draft tersembunyi; id_admin tidak bocor', async () => {
    const r = await api('GET', '/potensi');
    assert.equal(r.status, 200);
    assert.equal(r.json.meta.total, 3);
    assert.ok(r.json.data.every((p) => p.status === 'terbit'));
    assert.ok(r.json.data.every((p) => !('id_admin' in p)));
    assert.ok(!r.json.data.some((p) => /Wisata Sawah D/.test(p.nama_potensi)));
  });
  test('whatsapp_link terbentuk dari kontak yang valid, null bila tidak ada', async () => {
    const r = await api('GET', '/potensi?q=Kerajinan');
    assert.match(r.json.data[0].whatsapp_link, /^https:\/\/wa\.me\/6281200000002\?text=/);
  });
  test('filter kategori memakai nama atau id', async () => {
    const byName = await api('GET', '/potensi?kategori=KERAJINAN');
    assert.equal(byName.json.data.length, 1);
    const byId = await api('GET', `/potensi?kategori=${await kat('Kuliner')}`);
    assert.equal(byId.json.data.length, 1); assert.equal(byId.json.data[0].nama_kategori, 'Kuliner');
  });
  test('pencarian q pada nama, deskripsi, dan alamat', async () => {
    assert.equal((await api('GET', '/potensi?q=anyaman')).json.data.length, 1);
    assert.equal((await api('GET', '/potensi?q=Dusun%20Contoh%203')).json.data.length, 1);
    assert.equal((await api('GET', '/potensi?q=tidak-ada-sama-sekali')).json.data.length, 0);
  });
  test('pagination dan batas limit', async () => {
    const r = await api('GET', '/potensi?limit=2&page=2');
    assert.equal(r.json.data.length, 1); assert.equal(r.json.meta.total_pages, 2);
    assert.equal((await api('GET', '/potensi?limit=9999')).json.meta.limit, 50);
  });
  test('param status diabaikan untuk publik', async () => {
    assert.ok((await api('GET', '/potensi?status=draft')).json.data.every((p) => p.status === 'terbit'));
  });
  test('latitude dan longitude dikembalikan sebagai angka', async () => {
    const r = await api('GET', '/potensi?q=Kerajinan');
    assert.equal(typeof r.json.data[0].latitude, 'number');
  });
  test('upaya SQL injection tidak merusak data', async () => {
    const r = await api('GET', '/potensi?q=' + encodeURIComponent("'; DROP TABLE potensi_desa; --") + '&kategori=' + encodeURIComponent("x' OR '1'='1"));
    assert.equal(r.status, 200); assert.equal(r.json.data.length, 0);
    assert.equal((await api('GET', '/potensi')).json.meta.total, 3);
  });
  test('wildcard % dianggap teks biasa', async () => {
    assert.equal((await api('GET', '/potensi?q=' + encodeURIComponent('%'))).json.data.length, 0);
  });
});

describe('GET /potensi/:id (UF01 langkah 5 dan 6)', () => {
  test('terbit -> 200 lengkap dengan kategori dan foto; draft -> 404', async () => {
    const list = await api('GET', '/potensi?limit=1');
    const r = await api('GET', `/potensi/${list.json.data[0].id_potensi}`);
    assert.equal(r.status, 200); assert.ok(Array.isArray(r.json.data.foto)); assert.ok(r.json.data.nama_kategori);
    const draftId = (await pool.query("SELECT id_potensi FROM potensi_desa WHERE status = 'draft'")).rows[0].id_potensi;
    assert.equal((await api('GET', `/potensi/${draftId}`)).status, 404);
    assert.equal((await api('GET', `/potensi/${draftId}`, { tok: token })).status, 200);
  });
  test('ID tidak valid -> 400; tidak ada -> 404', async () => {
    assert.equal((await api('GET', '/potensi/abc')).status, 400);
    assert.equal((await api('GET', '/potensi/999999')).status, 404);
  });
});

describe('GET /potensi/peta (GeoJSON untuk Leaflet)', () => {
  test('hanya yang terbit dan punya koordinat; urutan [lng, lat]', async () => {
    const r = await api('GET', '/potensi/peta');
    assert.equal(r.status, 200); assert.equal(r.json.type, 'FeatureCollection');
    assert.equal(r.json.features.length, 2);   // 3 terbit, 1 tanpa koordinat; draft dikecualikan
    const f = r.json.features.find((x) => /Kerajinan/.test(x.properties.nama_potensi));
    assert.equal(f.geometry.type, 'Point');
    assert.deepEqual(f.geometry.coordinates, [111.903, -8.067]);
  });
  test('filter kategori pada peta', async () => {
    const r = await api('GET', '/potensi/peta?kategori=kuliner');
    assert.equal(r.json.features.length, 1);
  });
});

describe('POST /potensi (admin; UF02 langkah 5 dan 6)', () => {
  test('tanpa token -> 401', async () => { assert.equal((await api('POST', '/potensi', { body: mk() })).status, 401); });
  test('valid -> 201, status default draft, id_admin terisi, foto tersimpan', async () => {
    const r = await api('POST', '/potensi', { tok: token, body: mk({ nama_potensi: 'Dengan Foto', latitude: -8.07, longitude: 111.91, kontak: '0812-3456-7890',
      foto: [{ url_foto: 'https://example.com/a.jpg', caption: 'A' }, { url_foto: '/uploads/b.jpg' }] }) });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.status, 'draft'); assert.ok(r.json.data.id_admin > 0);
    assert.equal(r.json.data.foto.length, 2);
    assert.match(r.json.data.whatsapp_link, /wa\.me\/6281234567890/);
    assert.match(r.headers.get('location'), /^\/potensi\/\d+$/);
  });
  test('id_kategori tidak ada -> 400 dan tidak ada data tersisa', async () => {
    const before = (await pool.query('SELECT count(*)::int c FROM potensi_desa')).rows[0].c;
    const r = await api('POST', '/potensi', { tok: token, body: mk({ id_kategori: 999999, foto: [{ url_foto: 'https://example.com/x.jpg' }] }) });
    assert.equal(r.status, 400);
    assert.equal((await pool.query('SELECT count(*)::int c FROM potensi_desa')).rows[0].c, before);
    assert.equal((await pool.query("SELECT count(*)::int c FROM foto_potensi WHERE url_foto = 'https://example.com/x.jpg'")).rows[0].c, 0);
  });
  test('validasi: wajib, koordinat tunggal, rentang, status, foto', async () => {
    assert.deepEqual((await api('POST', '/potensi', { tok: token, body: {} })).json.errors.map((e) => e.field).sort(), ['id_kategori', 'nama_potensi']);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ latitude: -8 }) })).status, 400);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ latitude: 95, longitude: 111 }) })).status, 400);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ latitude: 'abc', longitude: 111 }) })).status, 400);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ status: 'aktif' }) })).status, 400);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ foto: [{ url_foto: 'javascript:alert(1)' }] }) })).status, 400);
    assert.equal((await api('POST', '/potensi', { tok: token, body: mk({ nama_potensi: 'a'.repeat(151) }) })).status, 400);
  });
});

describe('PUT dan DELETE /potensi/:id (admin)', () => {
  let id;
  before(async () => { id = (await api('POST', '/potensi', { tok: token, body: mk({ nama_potensi: 'Untuk Diubah', foto: [{ url_foto: 'https://example.com/f.jpg' }] }) })).json.data.id_potensi; });
  test('tanpa token -> 401', async () => { assert.equal((await api('PUT', `/potensi/${id}`, { body: { status: 'terbit' } })).status, 401); });
  test('terbitkan: tampil publik, updated_at berubah', async () => {
    const t0 = (await api('GET', `/potensi/${id}`, { tok: token })).json.data.updated_at;
    await new Promise((r) => setTimeout(r, 25));
    const r = await api('PUT', `/potensi/${id}`, { tok: token, body: { status: 'terbit', deskripsi: 'Deskripsi baru' } });
    assert.equal(r.status, 200); assert.equal(r.json.data.status, 'terbit');
    assert.ok(new Date(r.json.data.updated_at) > new Date(t0));
    assert.equal((await api('GET', `/potensi/${id}`)).status, 200);
  });
  test('koordinat harus berpasangan; boleh dikosongkan bersama', async () => {
    assert.equal((await api('PUT', `/potensi/${id}`, { tok: token, body: { latitude: -8.1 } })).status, 400);
    assert.equal((await api('PUT', `/potensi/${id}`, { tok: token, body: { latitude: -8.1, longitude: 111.9 } })).status, 200);
    assert.equal((await api('PUT', `/potensi/${id}`, { tok: token, body: { latitude: null, longitude: null } })).json.data.latitude, null);
  });
  test('body kosong 400; tidak ada 404; ID salah 400', async () => {
    assert.equal((await api('PUT', `/potensi/${id}`, { tok: token, body: {} })).status, 400);
    assert.equal((await api('PUT', '/potensi/999999', { tok: token, body: { status: 'terbit' } })).status, 404);
    assert.equal((await api('PUT', '/potensi/abc', { tok: token, body: { status: 'terbit' } })).status, 400);
  });
  test('admin melihat draft dan id_admin; status tidak valid 400', async () => {
    const r = await api('GET', '/potensi?status=draft', { tok: token });
    assert.ok(r.json.data.length >= 1 && r.json.data.every((p) => p.status === 'draft'));
    assert.ok('id_admin' in r.json.data[0]);
    assert.equal((await api('GET', '/potensi?status=aktif', { tok: token })).status, 400);
  });
  test('DELETE: 401 tanpa token; 200 lalu 404; foto ikut terhapus (CASCADE)', async () => {
    assert.equal((await api('DELETE', `/potensi/${id}`)).status, 401);
    assert.equal((await pool.query('SELECT count(*)::int c FROM foto_potensi WHERE id_potensi = $1', [id])).rows[0].c, 1);
    assert.equal((await api('DELETE', `/potensi/${id}`, { tok: token })).status, 200);
    assert.equal((await pool.query('SELECT count(*)::int c FROM foto_potensi WHERE id_potensi = $1', [id])).rows[0].c, 0);
    assert.equal((await api('DELETE', `/potensi/${id}`, { tok: token })).status, 404);
  });
});

describe('foto potensi (FOTO_POTENSI)', () => {
  let pid, fid;
  before(async () => { pid = (await api('POST', '/potensi', { tok: token, body: mk({ nama_potensi: 'Untuk Foto' }) })).json.data.id_potensi; });
  test('POST foto: 401 tanpa token, 201 valid, 400 URL buruk, 404 potensi tidak ada', async () => {
    assert.equal((await api('POST', `/potensi/${pid}/foto`, { body: { url_foto: 'https://example.com/1.jpg' } })).status, 401);
    const r = await api('POST', `/potensi/${pid}/foto`, { tok: token, body: { url_foto: 'https://example.com/1.jpg', caption: 'Satu' } });
    assert.equal(r.status, 201); fid = r.json.data.id_foto;
    assert.equal((await api('POST', `/potensi/${pid}/foto`, { tok: token, body: { url_foto: 'ftp://x' } })).status, 400);
    assert.equal((await api('POST', '/potensi/999999/foto', { tok: token, body: { url_foto: 'https://example.com/1.jpg' } })).status, 404);
  });
  test('PUT dan DELETE foto', async () => {
    assert.equal((await api('PUT', `/foto/${fid}`, { tok: token, body: { caption: 'Diubah' } })).json.data.caption, 'Diubah');
    assert.equal((await api('PUT', `/foto/${fid}`, { tok: token, body: {} })).status, 400);
    assert.equal((await api('PUT', '/foto/999999', { tok: token, body: { caption: 'x' } })).status, 404);
    assert.equal((await api('DELETE', `/foto/${fid}`)).status, 401);
    assert.equal((await api('DELETE', `/foto/${fid}`, { tok: token })).status, 200);
    assert.equal((await api('DELETE', `/foto/${fid}`, { tok: token })).status, 404);
  });
});
