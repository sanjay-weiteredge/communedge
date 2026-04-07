'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'name', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'email',
        });
        await queryInterface.addColumn('users', 'phone', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'name',
        });
        await queryInterface.addColumn('users', 'bio', {
            type: Sequelize.TEXT,
            allowNull: true,
            after: 'auth_provider',
        });
        await queryInterface.addColumn('users', 'linkedin_url', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'bio',
        });
        await queryInterface.addColumn('users', 'location', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'linkedin_url',
        });
        await queryInterface.addColumn('users', 'password_hash', {
            type: Sequelize.TEXT,
            allowNull: true,
            after: 'auth_provider',
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'password_hash');
        await queryInterface.removeColumn('users', 'location');
        await queryInterface.removeColumn('users', 'linkedin_url');
        await queryInterface.removeColumn('users', 'bio');
        await queryInterface.removeColumn('users', 'phone');
        await queryInterface.removeColumn('users', 'name');
    }
};
