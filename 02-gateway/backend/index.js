// Importa las herramientas para crear el servidor, permitir solicitudes
// del frontend y leer las variables de entorno.
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importa la conexión a MariaDB configurada con Sequelize.
const sequelize = require('./db');

// Crea y configura el servidor para recibir datos JSON.
const app = express();
app.use(cors());
app.use(express.json());

// Ruta para comprobar que el backend funciona.
app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'CE5508 - Backend Taller Docker + Login' });
});

app.use('/proyectos', require('./routes/proyectos'));

const PORT = process.env.PORT || 4000;

async function start() {
  let intentos = 0;
  const maxIntentos = 10;
  // Intenta conectarse hasta 10 veces, esperando 3 segundos si falla.
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
  // Sincroniza los modelos con MariaDB.
  await sequelize.sync();
  console.log('Modelos sincronizados con la base de datos');
  // Inicia el backend en el puerto indicado.
  app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
  });
}

start();
