const { ServicePlan, Service } = require('../models');

exports.createPlan = async (req, res) => {
    try {
        const { name, description, price, service_id } = req.body;
        if (!name || !service_id) {
            return res.status(400).json({ error: 'Name and Service ID (Category) are required' });
        }

        const plan = await ServicePlan.create({
            name,
            description,
            price,
            service_id
        });

        res.status(201).json(plan);
    } catch (error) {
        console.error('Create Plan Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllPlans = async (req, res) => {
    try {
        const plans = await ServicePlan.findAll({
            include: [{
                model: Service,
                as: 'parentService',
                attributes: ['name']
            }],
            order: [['created_at', 'DESC']]
        });
        res.json(plans);
    } catch (error) {
        console.error('Get Plans Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, service_id, is_active } = req.body;

        const plan = await ServicePlan.findByPk(id);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        await plan.update({
            name: name || plan.name,
            description: description !== undefined ? description : plan.description,
            price: price !== undefined ? price : plan.price,
            service_id: service_id || plan.service_id,
            is_active: is_active !== undefined ? is_active : plan.is_active
        });

        res.json(plan);
    } catch (error) {
        console.error('Update Plan Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await ServicePlan.findByPk(id);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        await plan.destroy();
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Delete Plan Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
