const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServicePlan extends Model {
        static associate(models) {
            ServicePlan.belongsTo(models.Service, { foreignKey: 'service_id', as: 'parentService' });
            ServicePlan.hasMany(models.FormSubmission, { foreignKey: 'plan_id', as: 'submissions' });
        }
    }

    ServicePlan.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        price: {
            type: DataTypes.STRING,
        },
        service_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'ServicePlan',
        tableName: 'service_plans',
        underscored: true,
    });

    return ServicePlan;
};
