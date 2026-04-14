const { Partner } = require('../models');

exports.getAllPartners = async (req, res) => {
    try {
        const partners = await Partner.findAll({
            order: [['display_order', 'ASC'], ['name', 'ASC']]
        });
        res.json(partners);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.createPartner = async (req, res) => {
    try {
        const { name, category, logo_url, website_url, display_order, is_active } = req.body;
        const partner = await Partner.create({
            name,
            category,
            logo_url,
            website_url,
            display_order: display_order || 0,
            is_active: is_active !== undefined ? is_active : true
        });
        res.status(201).json(partner);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, logo_url, website_url, display_order, is_active } = req.body;

        const partner = await Partner.findByPk(id);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });

        await partner.update({
            name: name || partner.name,
            category: category || partner.category,
            logo_url: logo_url || partner.logo_url,
            website_url: website_url || partner.website_url,
            display_order: display_order !== undefined ? display_order : partner.display_order,
            is_active: is_active !== undefined ? is_active : partner.is_active
        });

        res.json({ message: 'Partner updated successfully', partner });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deletePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.findByPk(id);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });

        await partner.destroy();
        res.json({ message: 'Partner deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
