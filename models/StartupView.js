const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StartupView extends Model {
        static associate(models) {
            StartupView.belongsTo(models.Startup, { foreignKey: 'startup_id', as: 'startup' });
            StartupView.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        }
    }

    StartupView.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        startup_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.UUID,
        },
        ip_address: {
            type: DataTypes.STRING,
        },
        user_agent: {
            type: DataTypes.TEXT,
        },
    }, {
        sequelize,
        modelName: 'StartupView',
        tableName: 'startup_views',
        underscored: true,
        indexes: [
            { fields: ['startup_id'] }
        ],
        hooks: {
            afterCreate: async (view) => {
                const { StartupMetric } = sequelize.models;
                const [metric] = await StartupMetric.findOrCreate({
                    where: { startup_id: view.startup_id },
                    defaults: { startup_id: view.startup_id },
                });
                await metric.increment('total_views');
            }
        }
    });

    return StartupView;
};
