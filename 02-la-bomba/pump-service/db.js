// Conexión a la base de OPERACIÓN. Ya funciona: no hay que tocarlo.
//
// Fíjense en el usuario: pump_user, no root. Tiene permisos solo
// sobre Bombas, Productos y EventosControl — y lectura sobre
// Proyectos. Si intentan escribir en Proyectos, MariaDB lo rechaza.
// Los permisos están en database/operacion/03-permisos.sql
//
// A esta base NO llegan los usuarios: viven en otra, con otro
// servicio y en otra red. Aquí solo tienen el id que trae el token.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'operacion-db',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'pump_user',
  password: process.env.DB_PASSWORD || 'pump_pass',
  database: process.env.DB_NAME || 'operacion',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
