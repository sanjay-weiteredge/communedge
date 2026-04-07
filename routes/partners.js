const express = require('express');
const router = express.Router();
const { Partner } = require('../models');

// @route   GET api/partners
// @desc    Get all active partners/VC firms
// @access  Public
router.get('/', async (req, res) => {
    try {
        const partners = await Partner.findAll({
            where: { is_active: true },
            order: [['display_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(partners);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/partners
// @desc    Add a new partner
// @access  Public (Can be protected later)
router.post('/', async (req, res) => {
    try {
        const { name, category, logo_url, website_url, display_order } = req.body;
        const partner = await Partner.create({
            name,
            category,
            logo_url,
            website_url,
            display_order
        });
        res.status(201).json(partner);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
