const express = require('express');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const db = require('../db');

// Configure Cloudinary from environment (supports CLOUDINARY_URL or discrete keys)
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

const router = express.Router();

function requireCloudinaryConfig() {
  if (process.env.CLOUDINARY_URL) return [];
  const missing = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  return missing;
}

// POST /api/blog-images/upload
router.post('/upload', async (req, res) => {
  const missing = requireCloudinaryConfig();
  if (missing.length) {
    return res.status(400).json({
      error: `Missing Cloudinary config: ${missing.join(', ')}`,
    });
  }

  const imagesDir = path.join(__dirname, '..', '..', 'images');
  const folder = process.env.CLOUDINARY_FOLDER || 'blogs';

  const summary = {
    total: 0,
    uploaded: 0,
    skipped_remote: 0,
    missing_files: 0,
    updated: 0,
    already_uploaded: 0,
    errors: [],
  };

  try {
    const { rows } = await db.query(
      "SELECT id, image FROM blog WHERE image IS NOT NULL AND image <> '' ORDER BY id"
    );
    summary.total = rows.length;

    for (const row of rows) {
      const id = row.id;
      const imageVal = String(row.image || '').trim();
      const publicIdBase = `blog_${id}`;
      const publicId = folder ? `${folder}/${publicIdBase}` : publicIdBase;

      // Check if asset already exists in Cloudinary; if so, skip upload
      try {
        const existing = await cloudinary.api.resource(publicId);
        if (existing && (existing.secure_url || existing.url)) {
          summary.already_uploaded++;
          // Backfill DB if current value is not a URL
          if (!/^https?:\/\//i.test(imageVal)) {
            const existingUrl = existing.secure_url || existing.url;
            await db.query('UPDATE blog SET image = $1 WHERE id = $2', [existingUrl, id]);
            summary.updated++;
          }
          continue;
        }
      } catch (err) {
        // If the asset is not found (404), proceed to upload; else record error
        if (err && err.http_code && err.http_code !== 404) {
          summary.errors.push({ id, image: imageVal, error: `check_resource: ${err.message}` });
        }
      }

      // Skip if already a URL (but not found in Cloudinary)
      if (/^https?:\/\//i.test(imageVal)) {
        summary.skipped_remote++;
        continue;
      }

      const localPath = path.join(imagesDir, imageVal);
      if (!fs.existsSync(localPath)) {
        summary.missing_files++;
        summary.errors.push({ id, image: imageVal, error: 'file_not_found' });
        continue;
      }

      try {
        const uploadResult = await cloudinary.uploader.upload(localPath, {
          folder,
          use_filename: true,
          unique_filename: false,
          overwrite: true,
          resource_type: 'image',
          public_id: publicIdBase,
        });
        const url = uploadResult.secure_url || uploadResult.url;
        summary.uploaded++;

        if (url) {
          await db.query('UPDATE blog SET image = $1 WHERE id = $2', [url, id]);
          summary.updated++;
        }
      } catch (err) {
        summary.errors.push({ id, image: imageVal, error: err.message });
      }
    }

    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: err.message, summary });
  }
});

module.exports = router;