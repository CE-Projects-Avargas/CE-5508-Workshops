// Conexión a MariaDB. Ya funciona: no hay que tocar este archivo.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mariadb',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'dispositivos_medicos',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
