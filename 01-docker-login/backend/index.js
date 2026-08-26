const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'CE5508 - Backend Taller Docker + Login' });
});

app.use('/auth', require('./routes/auth'));
app.use('/proyectos', require('./routes/proyectos'));

const PORT = process.env.PORT || 4000;

async function start() {
  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await sequelize.authenticate();
      console.log('Conexion a MariaDB establecida');
      break;
    } catch (err) {
      intentos++;
      console.log(`No se pudo conectar a la BD (intento ${intentos}/${maxIntentos}), reintentando en 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  await sequelize.sync();
  console.log('Modelos sincronizados con la base de datos');

  app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
  });
}

start();
