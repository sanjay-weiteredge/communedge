const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const adminAuth = require('../middleware/adminAuth');


router.get('/', partnerController.getAllPartners);


router.post('/', adminAuth, partnerController.createPartner);


router.put('/:id', adminAuth, partnerController.updatePartner);


router.delete('/:id', adminAuth, partnerController.deletePartner);

module.exports = router;
