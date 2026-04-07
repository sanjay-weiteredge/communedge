'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');
        if (!tableInfo.password_hash) {
            await queryInterface.addColumn('users', 'password_hash', {
                type: Sequelize.TEXT,
                allowNull: true,
                after: 'auth_provider',
            });
        }
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'password_hash');
    }
};
