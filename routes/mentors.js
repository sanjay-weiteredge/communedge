const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const adminAuth = require('../middleware/adminAuth');

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', mentorController.getAllMentors);
router.get('/:id', mentorController.getMentorById);

// ── Admin-only routes (multipart/form-data supported for avatar upload) ───────
router.post(
    '/',
    adminAuth,
    mentorController.uploadAvatarMiddleware, // multer: parses 'avatar' file field
    mentorController.createMentor
);

router.put(
    '/:id',
    adminAuth,
    mentorController.uploadAvatarMiddleware, // multer: optional avatar replacement
    mentorController.updateMentor
);

router.delete('/:id', adminAuth, mentorController.deleteMentor);

module.exports = router;
