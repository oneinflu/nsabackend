const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/blogs - list blogs with pagination
router.get('/', async (req, res) => {
  try {
    const includeContent = String(req.query.includeContent || '').toLowerCase() === 'true';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSizeRaw = parseInt(req.query.pageSize || '9', 10);
    const pageSize = Math.min(Math.max(pageSizeRaw || 9, 1), 200); // cap pageSize to 200
    const offset = (page - 1) * pageSize;

    const select = includeContent
      ? `SELECT * FROM blog ORDER BY date DESC NULLS LAST, id ASC LIMIT $1 OFFSET $2`
      : `SELECT id, title, excerpt, image, date, category_id, slug, author, status,
                approved_by, approved_on, feedback, keywords, votes, alt_tag, author_name
         FROM blog ORDER BY date DESC NULLS LAST, id ASC LIMIT $1 OFFSET $2`;

    const [{ rows }, countResult] = await Promise.all([
      db.query(select, [pageSize, offset]),
      db.query('SELECT COUNT(*)::int AS total FROM blog'),
    ]);

    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    res.json({
      data: rows,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/:id - get single blog by id (full)
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }
  try {
    const { rows } = await db.query('SELECT * FROM blog WHERE id = $1', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/slug/:slug - get single blog by slug
router.get('/slug/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) {
    return res.status(400).json({ error: 'Invalid blog slug' });
  }
  try {
    const { rows } = await db.query('SELECT * FROM blog WHERE slug = $1 LIMIT 1', [slug]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/:id/sections - list sections for a blog
router.get('/:id/sections', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }
  try {
    const { rows } = await db.query(
      'SELECT id, blog_id, section, content, cta FROM blog_sections WHERE blog_id = $1 ORDER BY id ASC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/:id/faqs - list FAQs for a blog
router.get('/:id/faqs', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }
  try {
    const { rows } = await db.query(
      'SELECT id, blog_id, question, answer FROM blog_faqs WHERE blog_id = $1 ORDER BY id ASC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;