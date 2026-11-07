const config = require('./config').load();
const { createPool } = require('./db');
const { createApp } = require('./app');

const pool = createPool(config.databaseUrl);
const app = createApp({ pool, config });
const server = app.listen(config.port, () => console.log(`API berjalan di http://localhost:${config.port}`));

function shutdown() { server.close(() => pool.end().then(() => process.exit(0))); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
