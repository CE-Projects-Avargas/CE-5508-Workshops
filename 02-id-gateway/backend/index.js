const express = require('express');
require('dotenv').config();

const sequelize = require('./db');

const app = express();
// Sin cors(): CORS se resuelve una sola vez en el gateway.
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'CE5508 - Backend Taller 2 (JWKS)' });
});

// Todo /proyectos exige un JWT valido de auth-service, se llegue por el
// gateway o directo al puerto 4000 (defensa en profundidad).
app.use('/proyectos', require('./middleware/auth'), require('./routes/proyectos'));

const PORT = process.env.PORT || 4000;

async function start() {
  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await sequelize.authenticate();
      console.log('Conexion a backend-db establecida');
      break;
    } catch (err) {
      intentos++;
      console.log(`No se pudo conectar a la BD (intento ${intentos}/${maxIntentos}), reintentando en 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Sin sequelize.sync(): el esquema lo crea backend-db/init/*.sql
  // y backend_user no tiene permiso de CREATE (menor privilegio).

  app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
  });
}

start();