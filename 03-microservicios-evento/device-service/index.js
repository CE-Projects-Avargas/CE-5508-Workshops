require('dotenv').config();

const express = require('express');
const db = require('./db');
const verificarToken = require('./auth');
const deviceRoutes = require('./routes/devices');
const { iniciarOutbox } = require('./outbox');

const app = express();
const PORT = Number(process.env.PORT || 4003);

app.use(express.json());
app.use('/devices', verificarToken, deviceRoutes);

// Endpoint temporal para comprobar que el servicio está activo.
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    return res.status(200).json({
      status: 'ok',
      service: 'device-service',
      database: 'connected'
    });

  } catch (error) {
    console.error('Error al comprobar la conexión con MariaDB:', error.message);

    return res.status(503).json({
      status: 'error',
      service: 'device-service',
      database: 'unavailable'
    });
  }
});

async function startServer() {
  try {
    // Verificar la conexión antes de comenzar a recibir peticiones.
    await db.query('SELECT 1');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`device-service escuchando en el puerto ${PORT}`);
      iniciarOutbox();
    });
  } catch (error) {
    console.error('No se pudo conectar con la base de datos:', error.message);
    process.exit(1);
  }
}

startServer();
