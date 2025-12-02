const db = require('../db');

async function listByBlogId(blogId) {
  const res = await db.query('SELECT id, blog_id, section, content, cta FROM blog_sections WHERE blog_id = $1 ORDER BY id ASC', [blogId]);
  return res.rows;
}

async function nextId() {
  const res = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM blog_sections');
  return res.rows[0].id;
}

async function insert(values) {
  const res = await db.query('INSERT INTO blog_sections (id, blog_id, section, content, cta) VALUES ($1,$2,$3,$4,$5) RETURNING id, blog_id, section, content, cta', values);
  return res.rows[0];
}

async function update(blogId, sectionId, sets, values) {
  const sql = `UPDATE blog_sections SET ${sets.join(', ')} WHERE blog_id=$${values.length - 1} AND id=$${values.length} RETURNING id, blog_id, section, content, cta`;
  const res = await db.query(sql, values);
  return res.rows[0] || null;
}

module.exports = { listByBlogId, nextId, insert, update };
