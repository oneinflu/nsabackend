const { Pool } = require('pg');

const hasConnectionString = !!process.env.DATABASE_URL;
const base = { max: 10, idleTimeoutMillis: 30000 };

const config = hasConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
      // Neon and many hosted providers require SSL
      ssl: { rejectUnauthorized: false },
      ...base,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'nsabackend',
      // Optional SSL toggle for managed PG providers
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      ...base,
    };

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected PG client error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};