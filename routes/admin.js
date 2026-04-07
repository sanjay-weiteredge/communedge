const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const mentorController = require('../controllers/mentorController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);
router.post('/signup', adminController.createAdmin);

router.get('/pending-startups', adminAuth, adminController.getAllPendingStartups);
router.post('/approve/:id', adminAuth, adminController.approveStartup);
router.post('/reject/:id', adminAuth, adminController.rejectStartup);

router.get('/pending-posts', adminAuth, adminController.getAllPendingPosts);
router.post('/approve-post/:id', adminAuth, adminController.approvePost);
router.post('/reject-post/:id', adminAuth, adminController.rejectPost);
router.delete('/post/:id', adminAuth, adminController.deletePost);

router.delete('/startup/:id', adminAuth, adminController.deleteStartup);

router.get('/users', adminAuth, adminController.getAllUsers);

router.get('/comments', adminAuth, adminController.getAllComments);
router.delete('/comments/:id', adminAuth, adminController.adminDeleteComment);
router.patch('/comments/:id/hide', adminAuth, adminController.adminHideComment);
router.patch('/comments/:id/restore', adminAuth, adminController.adminRestoreComment);

// ── Mentor management ──────────────────────────────────────────────────────
// GET all mentors (including inactive) for the admin dashboard
router.get('/mentors', adminAuth, mentorController.adminGetAllMentors);
// Create, Update, Delete are handled directly via /api/mentors (adminAuth protected)

module.exports = router;

