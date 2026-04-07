const { sequelize } = require('./models');

async function check() {
    const [results, metadata] = await sequelize.query('DESCRIBE form_submissions');
    console.log(JSON.stringify(results, null, 2));
    process.exit();
}

check();
