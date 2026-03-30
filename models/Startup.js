const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Startup extends Model {
        static associate(models) {
            Startup.belongsTo(models.User, { foreignKey: 'owner_user_id', as: 'owner' });
            Startup.belongsTo(models.Category, { foreignKey: 'industry_id', as: 'industry' }); // Keeping for legacy/primary industry
            Startup.belongsToMany(models.Category, {
                through: models.StartupIndustry,
                foreignKey: 'startup_id',
                otherKey: 'category_id',
                as: 'industries'
            });
            Startup.hasMany(models.Founder, { foreignKey: 'startup_id', as: 'founders' });
            Startup.hasMany(models.StartupPost, { foreignKey: 'startup_id', as: 'posts' });
            Startup.hasOne(models.StartupMetric, { foreignKey: 'startup_id', as: 'metrics' });
            Startup.hasMany(models.StartupView, { foreignKey: 'startup_id', as: 'views' });
        }
    }

    Startup.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        owner_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tagline: {
            type: DataTypes.STRING,
        },
        description: {
            type: DataTypes.TEXT,
        },
        website_url: {
            type: DataTypes.TEXT,
        },
        logo_url: {
            type: DataTypes.TEXT,
        },
        banner_url: {
            type: DataTypes.TEXT,
        },
        industry_id: {
            type: DataTypes.UUID,
        },
        founded_year: {
            type: DataTypes.INTEGER,
        },
        team_size: {
            type: DataTypes.INTEGER,
        },
        location: {
            type: DataTypes.STRING,
        },
        funding_stage: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'DRAFT',
        },
        incorporation_certificate_url: {
            type: DataTypes.TEXT,
        },
        is_featured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        is_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        featured_rank: {
            type: DataTypes.INTEGER,
        },
        homepage_rank: {
            type: DataTypes.INTEGER,
        },
        approved_at: {
            type: DataTypes.DATE,
        },
        linkedin_url: {
            type: DataTypes.TEXT,
        },
        twitter_url: {
            type: DataTypes.TEXT,
        },
        instagram_url: {
            type: DataTypes.TEXT,
        },
        facebook_url: {
            type: DataTypes.TEXT,
        },

    }, {
        sequelize,
        modelName: 'Startup',
        tableName: 'startups',
        underscored: true,
        indexes: [
            { fields: ['owner_user_id'] },
            { fields: ['industry_id'] },
            { fields: ['status'] },
            { fields: ['is_featured'] }
        ]
    });

    return Startup;
};
