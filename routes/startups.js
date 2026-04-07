const express = require('express');
const router = express.Router();
const multer = require('multer');
const startupController = require('../controllers/startupController');
const { verifyToken, verifyOptionalToken } = require('../middleware/authMiddleware');

const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

const startupUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
        if (allowed) cb(null, true);
        else cb(new Error('Only image or PDF files are allowed'));
    }
});

router.post('/create', verifyToken, startupUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'incorporation_certificate', maxCount: 1 }
]), startupController.createStartup);
router.get('/all', startupController.getAllStartups);
router.get('/trending', startupController.getTrending);
router.get('/my-startup', verifyToken, startupController.getMyStartup);
router.get('/details/:id', verifyOptionalToken, startupController.getStartupById);

router.put('/:id', verifyToken, startupUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'incorporation_certificate', maxCount: 1 }
]), startupController.updateStartup);

router.delete('/:id', verifyToken, startupController.deleteStartup);

module.exports = router;
