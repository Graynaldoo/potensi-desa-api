require('dotenv').config();

function load(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi (lihat .env.example).');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET wajib diisi minimal 32 karakter (lihat .env.example).');
  }
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    corsOrigin: env.CORS_ORIGIN || '*',
    rateLimitMax: Number(env.RATE_LIMIT_MAX) || 120,
    loginRateLimitMax: Number(env.LOGIN_RATE_LIMIT_MAX) || 10,
  };
}
module.exports = { load };
