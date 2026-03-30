const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PostComment extends Model {
        static associate(models) {
            PostComment.belongsTo(models.StartupPost, { foreignKey: 'post_id', as: 'post' });
            PostComment.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
            PostComment.hasMany(models.CommentVote, { foreignKey: 'comment_id', as: 'votes' });
            PostComment.hasMany(models.PostComment, { foreignKey: 'parent_id', as: 'replies' });
            PostComment.belongsTo(models.PostComment, { foreignKey: 'parent_id', as: 'parent' });
        }
    }

    PostComment.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        post_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        parent_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'post_comments',
                key: 'id'
            }
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'ACTIVE',
        },
    }, {
        sequelize,
        modelName: 'PostComment',
        tableName: 'post_comments',
        underscored: true,
        indexes: [
            { fields: ['post_id'] },
            { fields: ['user_id'] },
            { fields: ['parent_id'] }
        ],
        hooks: {
            afterCreate: async (comment) => {
                const { PostVote } = sequelize.models;
                if (PostVote.recalculateAll) {
                    await PostVote.recalculateAll(comment.post_id);
                }
            },
            afterDestroy: async (comment) => {
                const { PostVote } = sequelize.models;
                if (PostVote.recalculateAll) {
                    await PostVote.recalculateAll(comment.post_id);
                }
            },
            afterUpdate: async (comment) => {
                // If status changed (e.g. moderated)
                if (comment.changed('status')) {
                    const { PostVote } = sequelize.models;
                    if (PostVote.recalculateAll) {
                        await PostVote.recalculateAll(comment.post_id);
                    }
                }
            }
        }
    });

    return PostComment;
};
