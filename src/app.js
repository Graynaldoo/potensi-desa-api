const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { buildRoutes } = require('./routes');

function createApp({ pool, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(rateLimit({ windowMs: 60 * 1000, max: config.rateLimitMax, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' } }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ success: true, status: 'ok' }); }
    catch (e) { res.status(503).json({ success: false, status: 'database tidak dapat dihubungi' }); }
  });
  app.use(authenticate(config.jwtSecret), buildRoutes(pool, config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
