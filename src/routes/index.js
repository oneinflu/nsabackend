const express = require('express');
const users = require('./users');
const blogImages = require('./blogImages');
const blogs = require('./blogs');

const router = express.Router();

router.use('/users', users);
router.use('/blog-images', blogImages);
router.use('/blogs', blogs);

module.exports = router;