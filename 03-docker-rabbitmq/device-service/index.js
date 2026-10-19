const express = require('express');

const { verificarConexion } = require('./db');
const devicesRouter = require('./routes/devices');
const { conectarRabbitMQ } = require('./rabbitmq');

const app = express();

const PORT = process.env.PORT || 6000;


// Permite recibir JSON en las peticiones.
app.use(express.json());


// Endpoint simple para comprobar que el servicio está vivo.
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'device-service'
  });
});


// Rutas de dispositivos.
app.use('/api/devices', devicesRouter);


// Inicia el servicio únicamente después de comprobar la base de datos.
async function iniciarServidor() {
  try {
    await verificarConexion();
    await conectarRabbitMQ();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`device-service escuchando en el puerto ${PORT}`);
    });

  } catch (error) {
    console.error(
      'No fue posible iniciar device-service:',
      error.message
    );

    process.exit(1);
  }
}


iniciarServidor();