const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StartupPost extends Model {
        static associate(models) {
            StartupPost.belongsTo(models.Startup, { foreignKey: 'startup_id', as: 'startup' });
            StartupPost.hasMany(models.PostVote, { foreignKey: 'post_id', as: 'postVotes' });
            StartupPost.hasMany(models.PostComment, { foreignKey: 'post_id', as: 'comments' });
            StartupPost.hasOne(models.PostMetric, { foreignKey: 'post_id', as: 'metrics' });
            StartupPost.hasMany(models.PostView, { foreignKey: 'post_id', as: 'views' });
        }
    }

    StartupPost.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        startup_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
        },
        content: {
            type: DataTypes.TEXT,
        },
        media_url: {
            type: DataTypes.TEXT,
        },
        media_type: {
            type: DataTypes.STRING,
        },
        thumbnail_url: {
            type: DataTypes.TEXT,
        },
        post_type: {
            type: DataTypes.STRING,
            defaultValue: 'UPDATE',
        },
        demo_link: {
            type: DataTypes.TEXT,
        },
        external_link: {
            type: DataTypes.TEXT,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'PENDING',
        },
        approved_at: {
            type: DataTypes.DATE,
        },
        comments_enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        is_pinned_trending: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        sequelize,
        modelName: 'StartupPost',
        tableName: 'startup_posts',
        underscored: true,
        indexes: [
            { fields: ['startup_id'] },
            { fields: ['status'] }
        ]
    });

    return StartupPost;
};
