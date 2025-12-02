const express = require('express');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
function maybeUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return upload.single('image')(req, res, next);
  }
  next();
}
const controller = require('../controllers/blogController');

const router = express.Router();

// GET /api/blogs - list blogs with pagination
router.get('/', controller.list);

// GET /api/blogs/:id - get single blog by id (full)
router.get('/:id', controller.getById);

// GET /api/blogs/:id/full - blog with sections and FAQs
router.get('/:id/full', controller.getFullById);

// GET /api/blogs/slug/:slug - get single blog by slug
router.get('/slug/:slug', controller.getBySlug);

// GET /api/blogs/slug/:slug/full - blog with sections and FAQs by slug
router.get('/slug/:slug/full', controller.getFullBySlug);

// GET /api/blogs/:id/sections - list sections for a blog
router.get('/:id/sections', controller.listSections);

// GET /api/blogs/:id/faqs - list FAQs for a blog
router.get('/:id/faqs', controller.listFaqs);

// POST /api/blogs - create a new blog
router.post('/', maybeUpload, controller.create);

router.post('/:id/sections', controller.createSection);

router.post('/:id/faqs', controller.createFaq);

router.put('/:id', controller.updateBlog);

router.put('/:id/sections/:sectionId', controller.updateSection);

router.put('/:id/faqs/:faqId', controller.updateFaq);

module.exports = router;
