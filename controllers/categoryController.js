const { Category, Startup, sequelize } = require('../models');
const { uploadImageToS3, getSignedUrlForView, isS3Value } = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM startups AS s
                            WHERE s.industry_id = "Category".id
                        )`),
                        'startupCount'
                    ]
                ]
            },
            order: [['name', 'ASC']]
        });

        const categoriesWithUrls = await Promise.all(categories.map(async (catInstance) => {
            const cat = catInstance.get({ plain: true });

            console.log(`Checking category: ${cat.name}, imageUrl: ${cat.imageUrl}`);
            const isS3 = isS3Value(cat.imageUrl);
            console.log(`isS3Value: ${isS3}`);

            if (cat.imageUrl && isS3) {
                try {
                    const signedUrl = await getSignedUrlForView(cat.imageUrl);
                    if (signedUrl) {
                        cat.imageUrl = signedUrl;
                    }
                } catch (err) {
                    console.error(`Failed to sign imageUrl for ${cat.name}:`, err.message);
                }
            }

            const isIconS3 = isS3Value(cat.iconUrl);
            if (cat.iconUrl && isIconS3) {
                try {
                    const signedUrl = await getSignedUrlForView(cat.iconUrl);
                    if (signedUrl) {
                        cat.iconUrl = signedUrl;
                    }
                } catch (err) {
                    console.error(`Failed to sign iconUrl for ${cat.name}:`, err.message);
                }
            }
            return cat;
        }));

        res.json(categoriesWithUrls);
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description, type } = req.body;
        let { iconUrl } = req.body;
        let imageUrl = req.body.imageUrl || req.body.image_url;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (req.file) {
            const fileName = `cat_${uuidv4()}`;
            const s3Url = await uploadImageToS3(
                req.file.buffer,
                'categories',
                fileName,
                req.file.mimetype
            );

            // For INDUSTRY types, the uploaded file is considered the icon
            if (type === 'INDUSTRY' || !type) {
                iconUrl = s3Url;
            } else {
                imageUrl = s3Url;
            }
        }

        const category = await Category.create({
            name,
            imageUrl,
            iconUrl,
            description,
            type: type || 'INDUSTRY'
        });
        res.status(201).json(category);
    } catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, type, is_active } = req.body;
        let { iconUrl } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        let imageUrl = req.body.imageUrl || req.body.image_url || category.imageUrl;

        if (req.file) {
            const fileName = `cat_${uuidv4()}`;
            const s3Url = await uploadImageToS3(
                req.file.buffer,
                'categories',
                fileName,
                req.file.mimetype
            );

            if (type === 'INDUSTRY' || (!type && category.type === 'INDUSTRY')) {
                iconUrl = s3Url;
            } else {
                imageUrl = s3Url;
            }
        }

        await category.update({
            name: name || category.name,
            description: description !== undefined ? description : category.description,
            imageUrl,
            iconUrl: iconUrl !== undefined ? iconUrl : category.iconUrl,
            type: type || category.type,
            is_active: is_active !== undefined ? is_active : category.is_active
        });

        res.json({ message: 'Category updated successfully', category });
    } catch (error) {
        console.error('Update Category Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // 1. Set industry_id to NULL for all startups using this category as primary
        await Startup.update(
            { industry_id: null },
            { where: { industry_id: id } }
        );

        // 2. Remove entries from the many-to-many join table (StartupIndustry)
        // Note: Assuming StartupIndustry model exists and is imported
        const { StartupIndustry } = require('../models');
        if (StartupIndustry) {
            await StartupIndustry.destroy({ where: { category_id: id } });
        }

        await category.destroy();

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete Category Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
