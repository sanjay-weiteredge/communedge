const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// --- Public Routes ---
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// --- Protected Routes ---
router.get('/profile/:id', verifyToken, authController.getProfile);
router.put('/profile/:id', verifyToken, upload.single('photo'), authController.updateProfile);
router.delete('/profile/:id', verifyToken, authController.deleteAccount);
router.delete('/profile/:id/photo', verifyToken, authController.deleteProfilePhoto);

module.exports = router;
