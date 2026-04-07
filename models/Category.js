const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Category extends Model {
        static associate(models) {
            Category.hasMany(models.Startup, { foreignKey: 'industry_id', as: 'startups' });
            Category.belongsToMany(models.Startup, {
                through: models.StartupIndustry,
                foreignKey: 'category_id',
                otherKey: 'startup_id',
                as: 'industries_startups'
            });
        }
    }

    Category.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        imageUrl: {
            type: DataTypes.TEXT,
            field: 'image_url',
            allowNull: true,
            comment: 'S3 URL for the category cover/banner image',
        },
        iconUrl: {
            type: DataTypes.TEXT,
            field: 'icon_url',
            allowNull: true,
            comment: 'S3 URL for the category icon image',
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'INDUSTRY',
            comment: 'Type of category: INDUSTRY, BANNER, ADVERTISEMENT'
        },
    }, {
        sequelize,
        modelName: 'Category',
        tableName: 'categories',
        underscored: true,
    });

    return Category;
};
