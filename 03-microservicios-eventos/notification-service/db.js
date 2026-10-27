const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'notificaciones',
  process.env.DB_USER || 'notification_user',
  process.env.DB_PASSWORD || 'notification_pass',
  {
    host: process.env.DB_HOST || 'notification-db',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    // Si notification-db se cae, que la consulta falle rapido (y el mensaje
    // pase a reintento) en vez de esperar el minuto que trae por defecto.
    pool: { acquire: 5000 }
  }
);

module.exports = sequelize;
