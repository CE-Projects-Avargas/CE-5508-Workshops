const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'dispositivos',
  process.env.DB_USER || 'device_user',
  process.env.DB_PASSWORD || 'device_pass',
  {
    host: process.env.DB_HOST || 'device-db',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

module.exports = sequelize;