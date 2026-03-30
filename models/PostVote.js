const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PostVote extends Model {
        static associate(models) {
            PostVote.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
            PostVote.belongsTo(models.StartupPost, { foreignKey: 'post_id', as: 'post' });
        }

        /**
         * Orchestrates recalculation for both the specific post and its parent startup.
         */
        static async recalculateAll(post_id) {
            try {
                await this.recalculateIndividualPostMetrics(post_id);
                await this.recalculateStartupMetrics(post_id);
            } catch (err) {
                console.error('[PostVote.recalculateAll] Error:', err);
            }
        }

        /**
         * Recalculates PostMetric for a specific post.
         */
        static async recalculateIndividualPostMetrics(post_id) {
            try {
                const { PostVote, StartupPost, PostMetric, PostComment } = sequelize.models;

                const post = await StartupPost.findByPk(post_id);
                if (!post) return;

                const upvotes = await PostVote.count({ where: { post_id, vote_type: 1 } });
                const downvotes = await PostVote.count({ where: { post_id, vote_type: -1 } });
                const net_votes = upvotes - downvotes;
                const comments_count = await PostComment.count({ where: { post_id, status: 'ACTIVE' } });

                const hours_since_creation = (Date.now() - new Date(post.createdAt || post.created_at).getTime()) / (1000 * 60 * 60);

                const [metric] = await PostMetric.findOrCreate({
                    where: { post_id },
                    defaults: { post_id },
                });
                const views = metric.total_views || 0;

                const trending_score = (net_votes + 1) / Math.pow(hours_since_creation + 2, 1.5) + (views * 0.05) + (comments_count * 0.1);

                await metric.update({
                    total_upvotes: upvotes,
                    total_downvotes: downvotes,
                    trending_score
                });

            } catch (err) {
                console.error('[PostVote.recalculateIndividualPostMetrics] Error:', err);
            }
        }

        /**
         * Recalculates StartupMetric for the startup that owns the given post.
         */
        static async recalculateStartupMetrics(post_id) {
            try {
                const { PostVote, StartupPost, StartupMetric } = sequelize.models;

                const post = await StartupPost.findByPk(post_id);
                if (!post) return;
                const startup_id = post.startup_id;

                const posts = await StartupPost.findAll({ where: { startup_id } });
                const postIds = posts.map(p => p.id);

                const upvotes = await PostVote.count({ where: { post_id: postIds, vote_type: 1 } });
                const downvotes = await PostVote.count({ where: { post_id: postIds, vote_type: -1 } });
                const net_votes = upvotes - downvotes;

                const newestPost = posts.reduce((latest, p) => {
                    const pTime = new Date(p.createdAt || p.created_at).getTime();
                    const lTime = latest ? new Date(latest.createdAt || latest.created_at).getTime() : 0;
                    return pTime > lTime ? p : latest;
                }, null);

                const hours_since_newest = newestPost
                    ? (Date.now() - new Date(newestPost.createdAt || newestPost.created_at).getTime()) / (1000 * 60 * 60)
                    : 8760;

                const [metric] = await StartupMetric.findOrCreate({
                    where: { startup_id },
                    defaults: { startup_id },
                });
                const views = metric.total_views || 0;

                const trending_score = (net_votes + 1) / Math.pow(hours_since_newest + 2, 1.5) + views * 0.05;

                await metric.update({ total_upvotes: upvotes, total_downvotes: downvotes, trending_score });

            } catch (err) {
                console.error('[PostVote.recalculateStartupMetrics] Error:', err);
            }
        }
    }

    PostVote.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        post_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        vote_type: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'PostVote',
        tableName: 'post_votes',
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'post_id'],
            },
            {
                fields: ['post_id'],
            },
        ],
        hooks: {
            afterCreate: async (vote) => {
                await PostVote.recalculateAll(vote.post_id);
            },
            afterUpdate: async (vote) => {
                await PostVote.recalculateAll(vote.post_id);
            },
            afterDestroy: async (vote) => {
                await PostVote.recalculateAll(vote.post_id);
            },
        },
    });

    return PostVote;
};
