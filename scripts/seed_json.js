const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('../src/db');

function readJsonData(fileName, tableName) {
  const full = path.join(__dirname, '..', 'migrations', fileName);
  const raw = fs.readFileSync(full, 'utf8');
  const arr = JSON.parse(raw);
  // phpMyAdmin export format: find the entry with { type: 'table', name: tableName, data: [...] }
  const tableEntry = arr.find((e) => e && e.type === 'table' && e.name === tableName);
  if (!tableEntry || !Array.isArray(tableEntry.data)) {
    throw new Error(`Invalid JSON format in ${fileName} for table ${tableName}`);
  }
  return tableEntry.data;
}

function toInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number.parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function toBool(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toUpperCase();
  if (s === 'YES' || s === 'TRUE' || s === '1') return true;
  if (s === 'NO' || s === 'FALSE' || s === '0') return false;
  return null;
}

async function ensureTables() {
  // Create blog table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog (
      id INTEGER PRIMARY KEY,
      title TEXT DEFAULT '',
      h2 TEXT DEFAULT '',
      initial_content TEXT,
      excerpt TEXT,
      image TEXT,
      date TIMESTAMPTZ,
      category_id INTEGER,
      slug TEXT,
      author INTEGER,
      status TEXT,
      approved_by INTEGER,
      approved_on TIMESTAMPTZ,
      feedback TEXT,
      keywords TEXT,
      votes INTEGER,
      alt_tag TEXT,
      author_name TEXT,
      schema_markup TEXT
    );
  `);

  // Ensure columns exist for previously created schemas
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS title TEXT DEFAULT ''`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS h2 TEXT DEFAULT ''`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS initial_content TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS excerpt TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS image TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS category_id INTEGER`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS slug TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS author INTEGER`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS status TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS approved_by INTEGER`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS approved_on TIMESTAMPTZ`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS feedback TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS keywords TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS votes INTEGER`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS alt_tag TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS author_name TEXT`);
  await db.query(`ALTER TABLE blog ADD COLUMN IF NOT EXISTS schema_markup TEXT`);

  // Create blog_sections table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_sections (
      id INTEGER PRIMARY KEY,
      blog_id INTEGER,
      section TEXT,
      content TEXT,
      cta BOOLEAN
    );
  `);

  // Create blog_faqs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_faqs (
      id INTEGER PRIMARY KEY,
      blog_id INTEGER,
      question TEXT,
      answer TEXT
    );
  `);
}

async function seedBlogs() {
  // Detect legacy column name without underscore
  const legacyColCheck = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='blog' AND column_name='initialcontent'`
  );
  const hasLegacyInitial = legacyColCheck.rowCount > 0;
  const rows = readJsonData('blog-part.json', 'blog');
  for (const r of rows) {
    const values = [
      toInt(r.id),
      r.title || '',
      r.h2 || '',
      r.initialContent || null,
      r.excerpt || null,
      r.image || null,
      r.date ? new Date(r.date) : null,
      toInt(r.categoryID),
      r.slug || null,
      toInt(r.author),
      r.status || null,
      toInt(r.approvedby),
      r.approvedOn ? new Date(r.approvedOn) : null,
      r.feedback || null,
      r.keywords || null,
      toInt(r.votes),
      r.altTag || null,
      r.authorName || null,
      r.schemaMarkup || null,
    ];
    const sql = `
      INSERT INTO blog (
        id, title, h2, initial_content, excerpt, image, date, category_id, slug, author, status,
        approved_by, approved_on, feedback, keywords, votes, alt_tag, author_name, schema_markup
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title,
        h2=EXCLUDED.h2,
        initial_content=EXCLUDED.initial_content,
        excerpt=EXCLUDED.excerpt,
        image=EXCLUDED.image,
        date=EXCLUDED.date,
        category_id=EXCLUDED.category_id,
        slug=EXCLUDED.slug,
        author=EXCLUDED.author,
        status=EXCLUDED.status,
        approved_by=EXCLUDED.approved_by,
        approved_on=EXCLUDED.approved_on,
        feedback=EXCLUDED.feedback,
        keywords=EXCLUDED.keywords,
        votes=EXCLUDED.votes,
        alt_tag=EXCLUDED.alt_tag,
        author_name=EXCLUDED.author_name,
        schema_markup=EXCLUDED.schema_markup;
    `;
    await db.query(sql, values);
    if (hasLegacyInitial) {
      // Backfill legacy column to satisfy NOT NULL constraints
      await db.query(
        `UPDATE blog SET initialcontent = initial_content WHERE id = $1 AND (initialcontent IS NULL OR initialcontent = '')`,
        [toInt(r.id)]
      );
    }
  }
}

async function seedSections() {
  const rows = readJsonData('blog-sections.json', 'blog-sections');
  for (const r of rows) {
    const values = [
      toInt(r.id),
      toInt(r.blog),
      r.section || null,
      r.content || null,
      toBool(r.cta),
    ];
    const sql = `
      INSERT INTO blog_sections (id, blog_id, section, content, cta)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET
        blog_id=EXCLUDED.blog_id,
        section=EXCLUDED.section,
        content=EXCLUDED.content,
        cta=EXCLUDED.cta;
    `;
    await db.query(sql, values);
  }
}

async function seedFaqs() {
  const rows = readJsonData('blog-faqs.json', 'blog-faqs');
  for (const r of rows) {
    const values = [
      toInt(r.id),
      toInt(r.blog),
      r.question || null,
      r.answer || null,
    ];
    const sql = `
      INSERT INTO blog_faqs (id, blog_id, question, answer)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (id) DO UPDATE SET
        blog_id=EXCLUDED.blog_id,
        question=EXCLUDED.question,
        answer=EXCLUDED.answer;
    `;
    await db.query(sql, values);
  }
}

async function run() {
  await ensureTables();
  await seedBlogs();
  await seedSections();
  await seedFaqs();
  console.log('JSON seeding complete.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });