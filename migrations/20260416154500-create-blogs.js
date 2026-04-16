'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('blogs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            slug: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            excerpt: {
                type: Sequelize.TEXT,
            },
            author: {
                type: Sequelize.STRING,
                defaultValue: 'Admin',
            },
            image_url: {
                type: Sequelize.TEXT,
            },
            category: {
                type: Sequelize.STRING,
            },
            status: {
                type: Sequelize.STRING,
                defaultValue: 'PUBLISHED',
            },
            published_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('blogs', ['slug']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('blogs');
    }
};
