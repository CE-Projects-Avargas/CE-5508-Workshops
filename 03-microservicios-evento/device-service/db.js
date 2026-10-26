const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST         || 'localhost',
  port: Number(process.env.DB_PORT  || 3306),
  database: process.env.DB_NAME     || 'devices',
  user: process.env.DB_USER         || 'device_user',
  password: process.env.DB_PASSWORD || 'device_pass',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
