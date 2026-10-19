const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'notification-db',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'notification_db',
  user: process.env.DB_USER || 'notification_user',
  password: process.env.DB_PASSWORD || 'notification123',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function verificarConexion() {
  const conexion = await pool.getConnection();

  try {
    await conexion.ping();
    console.log('notification-service conectado a notification-db');
  } finally {
    conexion.release();
  }
}

module.exports = {
  pool,
  verificarConexion
};