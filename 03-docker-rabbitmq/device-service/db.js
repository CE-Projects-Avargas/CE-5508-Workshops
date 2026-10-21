const mysql = require('mysql2/promise');

// Pool de conexiones exclusivo para device-db.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'device-db',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'device_db',
  user: process.env.DB_USER || 'device_user',
  password: process.env.DB_PASSWORD || 'device123',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Comprueba que la base de datos esté disponible.
async function verificarConexion() {
  const conexion = await pool.getConnection();

  try {
    await conexion.ping();
    console.log('device-service conectado a device-db');
  } finally {
    conexion.release();
  }
}

module.exports = {
  pool,
  verificarConexion
};