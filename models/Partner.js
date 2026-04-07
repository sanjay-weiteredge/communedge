const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Partner extends Model {
        static associate(models) {
            // Future associations if needed
        }
    }

    Partner.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'VC', // Default to VC Firm
            comment: 'e.g. "VC", "Accelerator", "Corporate"',
        },
        logo_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        website_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        display_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Partner',
        tableName: 'partners',
        underscored: true,
    });

    return Partner;
};
