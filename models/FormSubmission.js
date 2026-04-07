const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FormSubmission extends Model {
        static associate(models) {
            FormSubmission.belongsTo(models.ServicePlan, {
                foreignKey: 'plan_id',
                as: 'plan',
                onDelete: 'SET NULL'
            });
        }
    }

    FormSubmission.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true,
            },
        },
        phone: {
            type: DataTypes.STRING,
        },
        company_name: {
            type: DataTypes.STRING,
        },
        general_details: {
            type: DataTypes.TEXT,
        },
        plan_id: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        mentor_name: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'PENDING',
        },
    }, {
        sequelize,
        modelName: 'FormSubmission',
        tableName: 'form_submissions',
        underscored: true,
    });

    return FormSubmission;
};
