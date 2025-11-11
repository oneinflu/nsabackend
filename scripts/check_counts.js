require('dotenv').config();
const db = require('../src/db');

async function run() {
  const tables = ['blog', 'blog_sections', 'blog_faqs'];
  for (const t of tables) {
    try {
      const res = await db.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      console.log(`${t}: ${res.rows[0].c}`);
    } catch (err) {
      console.log(`${t}: error (${err.message})`);
    }
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });