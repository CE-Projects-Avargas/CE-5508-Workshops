const express = require('express');
const sequelize = require('./db');
const { conectar } = require('./events');

const app = express();
// Sin cors(): CORS se resuelve una sola vez en el gateway.
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'CE5508 - device-service Taller 3' });
});

// Todo /devices exige un JWT valido de auth-service (defensa en profundidad,
// igual que el backend), y cada ruta ademas comprueba que el recurso sea del usuario.
app.use('/devices', require('./middleware/auth'), require('./routes/devices'));

const PORT = process.env.PORT || 4100;

async function start() {
  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await sequelize.authenticate();
      console.log('Conexion a device-db establecida');
      break;
    } catch (err) {
      intentos++;
      console.log(`No se pudo conectar a la BD (intento ${intentos}/${maxIntentos}), reintentando en 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // RabbitMQ conecta en segundo plano (con reintentos), sin frenar el arranque.
  conectar();

  // Sin sequelize.sync(): el esquema lo crea device-db/init/*.sql
  app.listen(PORT, () => {
    console.log(`device-service corriendo en http://localhost:${PORT}`);
  });
}

start();