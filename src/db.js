const { Pool, types } = require('pg');
// NUMERIC (oid 1700) dikembalikan sebagai angka, bukan teks, agar latitude/longitude siap dipakai Leaflet.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

function createPool(databaseUrl) {
  return new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30000 });
}
module.exports = { createPool };
