const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            User.hasOne(models.Startup, { foreignKey: 'owner_user_id', as: 'startup' });
            User.hasMany(models.StartupView, { foreignKey: 'user_id', as: 'views' });
            User.hasMany(models.PostComment, { foreignKey: 'user_id', as: 'comments' });
        }
    }

    User.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        firebase_uid: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'USER',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        photo_url: {
            type: DataTypes.TEXT,
        },
        auth_provider: {
            type: DataTypes.STRING,
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        linkedin_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        password_hash: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: true,
    });

    return User;
};
