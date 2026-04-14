const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const mentorController = require('../controllers/mentorController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);
router.post('/signup', adminController.createAdmin);

router.get('/pending-startups', adminAuth, adminController.getAllPendingStartups);
router.get('/rejected-startups', adminAuth, adminController.getAllRejectedStartups);
router.get('/approved-startups', adminAuth, adminController.getAllApprovedStartups);
router.post('/approve/:id', adminAuth, adminController.approveStartup);
router.post('/reject/:id', adminAuth, adminController.rejectStartup);
router.patch('/startups/:id/feature', adminAuth, adminController.toggleFeatureStartup);

router.get('/pending-posts', adminAuth, adminController.getAllPendingPosts);
router.get('/approved-posts', adminAuth, adminController.getAllApprovedPosts);
router.post('/approve-post/:id', adminAuth, adminController.approvePost);
router.post('/reject-post/:id', adminAuth, adminController.rejectPost);
router.patch('/posts/:id/pin-trending', adminAuth, adminController.togglePinTrending);
router.delete('/post/:id', adminAuth, adminController.deletePost);

router.delete('/startup/:id', adminAuth, adminController.deleteStartup);

router.get('/users', adminAuth, adminController.getAllUsers);
router.get('/founders', adminAuth, adminController.getAllFounders);

router.get('/comments', adminAuth, adminController.getAllComments);
router.delete('/comments/:id', adminAuth, adminController.adminDeleteComment);
router.patch('/comments/:id/hide', adminAuth, adminController.adminHideComment);
router.patch('/comments/:id/restore', adminAuth, adminController.adminRestoreComment);


router.get('/mentors', adminAuth, mentorController.adminGetAllMentors);
router.get('/dashboard-stats', adminAuth, adminController.getDashboardStats);
router.get('/all-posts', adminAuth, adminController.getAllPosts);
router.patch('/posts/:id/toggle-comments', adminAuth, adminController.togglePostComments);

module.exports = router;

