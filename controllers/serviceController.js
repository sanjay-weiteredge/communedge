const { Service } = require('../models');

exports.createService = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const service = await Service.create({ name, description });
        res.status(201).json(service);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Service group already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;

        const service = await Service.findByPk(id);
        if (!service) return res.status(404).json({ error: 'Service group not found' });

        await service.update({
            name: name || service.name,
            description: description !== undefined ? description : service.description,
            is_active: is_active !== undefined ? is_active : service.is_active
        });

        res.json(service);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findByPk(id);
        if (!service) return res.status(404).json({ error: 'Service group not found' });

        await service.destroy();
        res.json({ message: 'Service group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
