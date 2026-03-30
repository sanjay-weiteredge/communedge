'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Indexes for startups table
        await queryInterface.addIndex('startups', ['owner_user_id']);
        await queryInterface.addIndex('startups', ['industry_id']);
        await queryInterface.addIndex('startups', ['status']);
        await queryInterface.addIndex('startups', ['is_featured']);

        // 2. Indexes for startup_posts table
        await queryInterface.addIndex('startup_posts', ['startup_id']);
        await queryInterface.addIndex('startup_posts', ['status']);

        // 3. Index for post_votes table (speed up metrics count)
        // Note: The unique index (user_id, post_id) already exists from model definition
        await queryInterface.addIndex('post_votes', ['post_id']);

        // 4. Index for startup_views table
        await queryInterface.addIndex('startup_views', ['startup_id']);

        // 5. Indexes for post_comments table
        await queryInterface.addIndex('post_comments', ['post_id']);
        await queryInterface.addIndex('post_comments', ['user_id']);
        await queryInterface.addIndex('post_comments', ['parent_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('startups', ['owner_user_id']);
        await queryInterface.removeIndex('startups', ['industry_id']);
        await queryInterface.removeIndex('startups', ['status']);
        await queryInterface.removeIndex('startups', ['is_featured']);

        await queryInterface.removeIndex('startup_posts', ['startup_id']);
        await queryInterface.removeIndex('startup_posts', ['status']);

        await queryInterface.removeIndex('post_votes', ['post_id']);

        await queryInterface.removeIndex('startup_views', ['startup_id']);

        await queryInterface.removeIndex('post_comments', ['post_id']);
        await queryInterface.removeIndex('post_comments', ['user_id']);
        await queryInterface.removeIndex('post_comments', ['parent_id']);
    }
};
