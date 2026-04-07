const { Service } = require('./models');

async function check() {
    const services = await Service.findAll({ where: { name: 'Mentorship' } });
    console.log(JSON.stringify(services, null, 2));
    process.exit();
}

check();
