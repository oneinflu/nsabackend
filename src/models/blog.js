const db = require('../db');

async function list(includeContent, limit, offset) {
  const select = includeContent
    ? 'SELECT * FROM blog ORDER BY date DESC NULLS LAST, id ASC LIMIT $1 OFFSET $2'
    : 'SELECT id, title, excerpt, image, date, category_id, slug, author, status, approved_by, approved_on, feedback, keywords, votes, alt_tag, author_name FROM blog ORDER BY date DESC NULLS LAST, id ASC LIMIT $1 OFFSET $2';
  const result = await db.query(select, [limit, offset]);
  return result.rows;
}

async function count() {
  const res = await db.query('SELECT COUNT(*)::int AS total FROM blog');
  return res.rows[0].total || 0;
}

async function getById(id) {
  const res = await db.query('SELECT * FROM blog WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function getBySlug(slug) {
  const res = await db.query('SELECT * FROM blog WHERE slug = $1 LIMIT 1', [slug]);
  return res.rows[0] || null;
}

async function existsById(id) {
  const res = await db.query('SELECT 1 FROM blog WHERE id = $1 LIMIT 1', [id]);
  return res.rowCount > 0;
}

async function existsSlug(slug, excludeId) {
  const params = excludeId ? [slug, excludeId] : [slug];
  const sql = excludeId ? 'SELECT 1 FROM blog WHERE slug=$1 AND id<>$2 LIMIT 1' : 'SELECT 1 FROM blog WHERE slug=$1 LIMIT 1';
  const res = await db.query(sql, params);
  return res.rowCount > 0;
}

async function nextId() {
  const res = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM blog');
  return res.rows[0].id;
}

async function insert(values) {
  const sql = 'INSERT INTO blog (id, title, h2, initial_content, excerpt, image, date, category_id, slug, author, status, approved_by, approved_on, feedback, keywords, votes, alt_tag, author_name, schema_markup) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *';
  const res = await db.query(sql, values);
  return res.rows[0];
}

async function update(id, sets, values) {
  const sql = `UPDATE blog SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`;
  const res = await db.query(sql, values);
  return res.rows[0] || null;
}

module.exports = { list, count, getById, getBySlug, existsById, existsSlug, nextId, insert, update };
