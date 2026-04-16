const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const adminAuth = require('../middleware/adminAuth');

// Public routes
router.get('/', blogController.getAllBlogs);
router.get('/:slug', blogController.getBlogBySlug);

// Admin-only routes
router.post('/', adminAuth, blogController.createBlog);
router.put('/:id', adminAuth, blogController.updateBlog);
router.delete('/:id', adminAuth, blogController.deleteBlog);

module.exports = router;
