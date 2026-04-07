'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('categories');
        if (!tableInfo.icon_url) {
            await queryInterface.addColumn('categories', 'icon_url', {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'S3 URL for the category icon image',
            });
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('categories', 'icon_url');
    }
};
