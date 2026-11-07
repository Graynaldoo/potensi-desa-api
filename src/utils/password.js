// Hash kata sandi dengan scrypt bawaan Node.js (tanpa dependensi tambahan).
// Format tersimpan: scrypt$N$r$p$salt(base64)$hash(base64)
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const N = 16384, R = 8, P = 1, KEYLEN = 64;

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), dk.toString('base64')].join('$');
}

async function verifyPassword(plain, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const dk = await scrypt(plain, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return crypto.timingSafeEqual(dk, expected);
}
module.exports = { hashPassword, verifyPassword };
