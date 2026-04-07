const { Service } = require('./models');

async function check() {
    const services = await Service.findAll();
    services.forEach(s => console.log(s.name, s.id));
    process.exit();
}

check();
