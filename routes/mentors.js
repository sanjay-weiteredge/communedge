const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const adminAuth = require('../middleware/adminAuth');

router.get('/', mentorController.getAllMentors);
router.get('/:id', mentorController.getMentorById);

router.post(
    '/',
    adminAuth,
    mentorController.uploadAvatarMiddleware,
    mentorController.createMentor
);

router.put(
    '/:id',
    adminAuth,
    mentorController.uploadAvatarMiddleware,
    mentorController.updateMentor
);

router.delete('/:id', adminAuth, mentorController.deleteMentor);

module.exports = router;
