const { v2: cloudinary } = require('cloudinary');
const blog = require('../models/blog');
const sections = require('../models/blogSections');
const faqs = require('../models/blogFaqs');
const db = require('../db');

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

exports.list = async (req, res) => {
  try {
    const includeContent = String(req.query.includeContent || '').toLowerCase() === 'true';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSizeRaw = parseInt(req.query.pageSize || '9', 10);
    const pageSize = Math.min(Math.max(pageSizeRaw || 9, 1), 200);
    const offset = (page - 1) * pageSize;
    const rows = await blog.list(includeContent, pageSize, offset);
    const total = await blog.count();
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    res.json({ data: rows, pagination: { page, pageSize, total, totalPages } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    const row = await blog.getById(id);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFullById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    const row = await blog.getById(id);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    const [sec, faq] = await Promise.all([
      sections.listByBlogId(id),
      faqs.listByBlogId(id),
    ]);
    res.json({ blog: row, sections: sec, faqs: faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'Invalid blog slug' });
  try {
    const row = await blog.getBySlug(slug);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFullBySlug = async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'Invalid blog slug' });
  try {
    const row = await blog.getBySlug(slug);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    const id = row.id;
    const [sec, faq] = await Promise.all([
      sections.listByBlogId(id),
      faqs.listByBlogId(id),
    ]);
    res.json({ blog: row, sections: sec, faqs: faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listSections = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    const rows = await sections.listByBlogId(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listFaqs = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    const rows = await faqs.listByBlogId(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const body = req.body || {};
    if (process.env.NODE_ENV !== 'production') {
      console.log('create content-type:', req.headers['content-type']);
      console.log('create body keys:', Object.keys(body));
    }
    const title = String(body.title || '').trim();
    let slug = String(body.slug || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!slug) slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const exists = await blog.existsSlug(slug);
    if (exists) return res.status(409).json({ error: 'slug already exists' });
    const newId = await blog.nextId();
    let imageUrl = body.image ?? null;
    const folder = process.env.CLOUDINARY_FOLDER || 'blogs';
    const file = req.file;
    if (file && file.buffer) {
      const publicIdBase = `blog_${newId}`;
      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, use_filename: true, unique_filename: false, overwrite: true, resource_type: 'image', public_id: publicIdBase },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(file.buffer);
      });
      imageUrl = uploadRes.secure_url || uploadRes.url || imageUrl;
    }
    const toInt = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const toNullableDate = (v) => (v ? new Date(v) : null);
    const values = [
      newId,
      title,
      String(body.h2 || ''),
      body.initial_content ?? null,
      body.excerpt ?? null,
      imageUrl,
      body.date ? new Date(body.date) : new Date(),
      toInt(body.category_id),
      slug,
      toInt(body.author),
      body.status ?? null,
      toInt(body.approved_by),
      toNullableDate(body.approved_on),
      body.feedback ?? null,
      body.keywords ?? null,
      toInt(body.votes),
      body.alt_tag ?? null,
      body.author_name ?? null,
      body.schema_markup ?? null,
    ];
    const row = await blog.insert(values);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSection = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  const body = req.body || {};
  const section = String(body.section || '').trim();
  const content = String(body.content || '').trim();
  const rawCta = body.cta;
  if (!section || !content) return res.status(400).json({ error: 'section and content required' });
  try {
    const exists = await blog.existsById(id);
    if (!exists) return res.status(404).json({ error: 'Blog not found' });
    const newId = await sections.nextId();
    let cta = null;
    if (typeof rawCta === 'boolean') cta = rawCta;
    else if (typeof rawCta === 'string') {
      if (/^(yes|true|1)$/i.test(rawCta)) cta = true;
      else if (/^(no|false|0)$/i.test(rawCta)) cta = false;
    }
    const row = await sections.insert([newId, id, section, content, cta]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createFaq = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  const body = req.body || {};
  const question = String(body.question || '').trim();
  const answer = String(body.answer || '').trim();
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  try {
    const exists = await blog.existsById(id);
    if (!exists) return res.status(404).json({ error: 'Blog not found' });
    const newId = await faqs.nextId();
    const row = await faqs.insert([newId, id, question, answer]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBlog = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    const body = req.body || {};
    const sets = [];
    const values = [];
    const toInt = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const toNullableDate = (v) => (v ? new Date(v) : null);
    if (body.title !== undefined) { sets.push(`title=$${sets.length + 1}`); values.push(String(body.title || '').trim()); }
    if (body.h2 !== undefined) { sets.push(`h2=$${sets.length + 1}`); values.push(String(body.h2 || '').trim()); }
    if (body.initial_content !== undefined) { sets.push(`initial_content=$${sets.length + 1}`); values.push(body.initial_content ?? null); }
    if (body.excerpt !== undefined) { sets.push(`excerpt=$${sets.length + 1}`); values.push(body.excerpt ?? null); }
    if (body.image !== undefined) { sets.push(`image=$${sets.length + 1}`); values.push(body.image ?? null); }
    if (body.date !== undefined) { sets.push(`date=$${sets.length + 1}`); values.push(toNullableDate(body.date)); }
    if (body.category_id !== undefined) { sets.push(`category_id=$${sets.length + 1}`); values.push(toInt(body.category_id)); }
    if (body.author !== undefined) { sets.push(`author=$${sets.length + 1}`); values.push(toInt(body.author)); }
    if (body.status !== undefined) { sets.push(`status=$${sets.length + 1}`); values.push(body.status ?? null); }
    if (body.approved_by !== undefined) { sets.push(`approved_by=$${sets.length + 1}`); values.push(toInt(body.approved_by)); }
    if (body.approved_on !== undefined) { sets.push(`approved_on=$${sets.length + 1}`); values.push(toNullableDate(body.approved_on)); }
    if (body.feedback !== undefined) { sets.push(`feedback=$${sets.length + 1}`); values.push(body.feedback ?? null); }
    if (body.keywords !== undefined) { sets.push(`keywords=$${sets.length + 1}`); values.push(body.keywords ?? null); }
    if (body.votes !== undefined) { sets.push(`votes=$${sets.length + 1}`); values.push(toInt(body.votes)); }
    if (body.alt_tag !== undefined) { sets.push(`alt_tag=$${sets.length + 1}`); values.push(body.alt_tag ?? null); }
    if (body.author_name !== undefined) { sets.push(`author_name=$${sets.length + 1}`); values.push(body.author_name ?? null); }
    if (body.schema_markup !== undefined) { sets.push(`schema_markup=$${sets.length + 1}`); values.push(body.schema_markup ?? null); }
    if (body.slug !== undefined) {
      let slug = String(body.slug || '').trim();
      if (!slug && body.title) slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (slug) {
        const exists = await blog.existsSlug(slug, id);
        if (exists) return res.status(409).json({ error: 'slug already exists' });
        sets.push(`slug=$${sets.length + 1}`);
        values.push(slug);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const row = await blog.update(id, sets, values);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSection = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sectionId = parseInt(req.params.sectionId, 10);
  if (Number.isNaN(id) || Number.isNaN(sectionId)) return res.status(400).json({ error: 'Invalid blog or section id' });
  try {
    const exists = await blog.existsById(id);
    if (!exists) return res.status(404).json({ error: 'Blog not found' });
    const body = req.body || {};
    const sets = [];
    const values = [];
    if (body.section !== undefined) { sets.push(`section=$${sets.length + 1}`); values.push(String(body.section || '').trim()); }
    if (body.content !== undefined) { sets.push(`content=$${sets.length + 1}`); values.push(String(body.content || '').trim()); }
    if (body.cta !== undefined) {
      const raw = body.cta;
      let cta = null;
      if (typeof raw === 'boolean') cta = raw;
      else if (typeof raw === 'string') cta = /^(yes|true|1)$/i.test(raw) ? true : (/^(no|false|0)$/i.test(raw) ? false : null);
      sets.push(`cta=$${sets.length + 1}`);
      values.push(cta);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    values.push(sectionId);
    const row = await sections.update(id, sectionId, sets, values);
    if (!row) return res.status(404).json({ error: 'Section not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateFaq = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const faqId = parseInt(req.params.faqId, 10);
  if (Number.isNaN(id) || Number.isNaN(faqId)) return res.status(400).json({ error: 'Invalid blog or faq id' });
  try {
    const exists = await blog.existsById(id);
    if (!exists) return res.status(404).json({ error: 'Blog not found' });
    const body = req.body || {};
    const sets = [];
    const values = [];
    if (body.question !== undefined) { sets.push(`question=$${sets.length + 1}`); values.push(String(body.question || '').trim()); }
    if (body.answer !== undefined) { sets.push(`answer=$${sets.length + 1}`); values.push(String(body.answer || '').trim()); }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    values.push(faqId);
    const row = await faqs.update(id, faqId, sets, values);
    if (!row) return res.status(404).json({ error: 'FAQ not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBlog = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid blog id' });
  let client;
  try {
    client = await db.getClient();
    await client.query('BEGIN');
    await client.query('DELETE FROM blog_sections WHERE blog_id=$1', [id]);
    await client.query('DELETE FROM blog_faqs WHERE blog_id=$1', [id]);
    const del = await client.query('DELETE FROM blog WHERE id=$1 RETURNING id', [id]);
    if (del.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Blog not found' });
    }
    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.deleteSection = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sectionId = parseInt(req.params.sectionId, 10);
  if (Number.isNaN(id) || Number.isNaN(sectionId)) return res.status(400).json({ error: 'Invalid blog or section id' });
  try {
    const del = await db.query('DELETE FROM blog_sections WHERE blog_id=$1 AND id=$2 RETURNING id', [id, sectionId]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'Section not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFaq = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const faqId = parseInt(req.params.faqId, 10);
  if (Number.isNaN(id) || Number.isNaN(faqId)) return res.status(400).json({ error: 'Invalid blog or faq id' });
  try {
    const del = await db.query('DELETE FROM blog_faqs WHERE blog_id=$1 AND id=$2 RETURNING id', [id, faqId]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'FAQ not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
