const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ FUTURE-PROOF CORS (supports all subdomains + .in/.com)
const allowedPattern = /^https?:\/\/([a-zA-Z0-9-]+\.)?communedge\.(in|com)$/;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedPattern.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/startups', require('./routes/startups'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/post-votes', require('./routes/postVotes'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/founders', require('./routes/founders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/services', require('./routes/services'));
app.use('/api/service-plans', require('./routes/servicePlans'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/mentors', require('./routes/mentors'));
app.use('/api/partners', require('./routes/partners'));

async function startServer() {
  try {
    await sequelize.authenticate({ logging: false });
    console.log('✅ Connection to the database has been established successfully.');

    await sequelize.sync({ alter: true, logging: false });
    console.log('✅ Database synchronized.');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;