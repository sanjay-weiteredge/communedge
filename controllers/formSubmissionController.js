const { FormSubmission, ServicePlan, Service } = require('../models');

exports.submitForm = async (req, res) => {
    try {
        const { name, email, phone, company_name, general_details, plan_id, mentor_name } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        if (!plan_id && !mentor_name) {
            return res.status(400).json({ error: 'Selected service plan or mentor is required' });
        }

        // Validate plan_id if provided
        if (plan_id) {
            const plan = await ServicePlan.findByPk(plan_id);
            if (!plan) {
                return res.status(404).json({ error: 'Selected pricing plan not found' });
            }
        }

        const submission = await FormSubmission.create({
            name,
            email,
            phone,
            company_name,
            general_details,
            plan_id: plan_id || null,
            mentor_name
        });

        res.status(201).json({ message: 'Form submitted successfully', submission });
    } catch (error) {
        console.error('Submit Form Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllSubmissions = async (req, res) => {
    try {
        const submissions = await FormSubmission.findAll({
            include: [{
                model: ServicePlan,
                as: 'plan',
                include: [{ model: Service, as: 'parentService', attributes: ['name'] }]
            }],
            order: [['created_at', 'DESC']]
        });
        res.json(submissions);
    } catch (error) {
        console.error('Get Submissions Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const submission = await FormSubmission.findByPk(id);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        submission.status = status;
        await submission.save();

        res.json({ message: 'Status updated successfully', submission });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
