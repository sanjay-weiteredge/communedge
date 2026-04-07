const express = require('express');
const router = express.Router();
const planController = require('../controllers/servicePlanController');
const adminAuth = require('../middleware/adminAuth');

router.get('/', planController.getAllPlans);
router.post('/', adminAuth, planController.createPlan);
router.put('/:id', adminAuth, planController.updatePlan);
router.delete('/:id', adminAuth, planController.deletePlan);

module.exports = router;
