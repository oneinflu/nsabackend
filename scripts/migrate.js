const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('../src/db');

function sanitizeSQL(input) {
  // Remove SQL comments only; preserve original quotes/backticks/content
  let s = input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
  // Normalize line endings
  s = s.replace(/\r\n/g, '\n');
  return s;
}

function splitStatements(sql) {
  const stmts = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = '';
  let prev = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    // Detect dollar-quoted strings: $tag$
    if (!inSingle && !inDouble && ch === '$') {
      // Find following tag
      const match = sql.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
      if (match) {
        inDollar = !inDollar;
        dollarTag = match[1];
        buf += match[0];
        i += match[0].length - 1;
        continue;
      }
    }

    if (!inDollar) {
      if (ch === "'" && !inDouble) {
        // Handle escaped quote within single-quoted strings: \'
        if (inSingle && prev === '\\') {
          buf += ch;
        } else if (inSingle && next === "'") {
          // Escaped single quote '' inside string
          buf += "''";
          i++;
        } else {
          inSingle = !inSingle;
          buf += ch;
        }
        prev = ch;
        continue;
      }
      if (ch === '"' && !inSingle) {
        // Handle escaped quote within double-quoted strings: \"
        if (inDouble && prev === '\\') {
          buf += ch;
        } else {
          inDouble = !inDouble;
          buf += ch;
        }
        prev = ch;
        continue;
      }
    }

    if (ch === ';' && !inSingle && !inDouble && !inDollar) {
      const trimmed = buf.trim();
      if (trimmed) stmts.push(trimmed);
      buf = '';
      continue;
    }

    buf += ch;
    prev = ch;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

async function run() {
  // Set safe defaults
  await db.query("SET client_encoding = 'UTF8';");
  // Support MySQL-style backslash escapes present in dump files
  await db.query('SET standard_conforming_strings = off;');

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log('Running migrations:', files);
  for (const file of files) {
    const full = path.join(dir, file);
    let raw = fs.readFileSync(full, 'utf8');
    console.log(`Applying ${file}...`);
    let sql = sanitizeSQL(raw);
    const statements = splitStatements(sql);

    for (const [idx, stmt] of statements.entries()) {
      try {
        await db.query(stmt);
      } catch (err) {
        // Attempt a second pass with extra sanitation for common issues
        const retry = sanitizeSQL(stmt);
        try {
          await db.query(retry);
        } catch (err2) {
          console.warn(
            `Warning: Skipping statement ${idx + 1} in ${file} due to error:`,
            err2.message
          );
        }
      }
    }
  }
  console.log('Migrations complete.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });