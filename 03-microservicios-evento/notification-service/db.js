// Pool de conexiones a notification-db
const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'notifications',
  user: process.env.DB_USER || 'notification_user',
  password: process.env.DB_PASSWORD || 'notification_pass',
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 5
});
