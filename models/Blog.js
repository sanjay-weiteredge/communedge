const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Blog extends Model {
        static associate(models) {
            // Associations can be defined here if needed
        }
    }

    Blog.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        excerpt: {
            type: DataTypes.TEXT,
        },
        author: {
            type: DataTypes.STRING,
            defaultValue: 'Admin',
        },
        image_url: {
            type: DataTypes.TEXT,
        },
        category: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'PUBLISHED', // or DRAFT
        },
        published_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'Blog',
        tableName: 'blogs',
        underscored: true,
    });

    return Blog;
};
