const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Mentor extends Model {
        static associate(models) {
            // Future: associations with bookings / requests can go here
        }
    }

    Mentor.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'e.g. "CTO", "Serial Entrepreneur"',
        },
        company: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        expertise: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment: 'Array of expertise strings e.g. ["AI/ML","Deep Tech"]',
        },
        avatar_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        linkedin_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        twitter_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isEmail: true },
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        display_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Controls the display order on the Mentors page',
        },
    }, {
        sequelize,
        modelName: 'Mentor',
        tableName: 'mentors',
        underscored: true,
    });

    return Mentor;
};
