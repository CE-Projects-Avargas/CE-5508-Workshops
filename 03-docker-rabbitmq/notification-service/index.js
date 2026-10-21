const { verificarConexion } = require('./db');
const { iniciarConsumidor } = require('./rabbitmq');

async function iniciarServicio() {
  try {
    await verificarConexion();
    await iniciarConsumidor();

    console.log('notification-service iniciado correctamente');

  } catch (error) {
    console.error(
      'No fue posible iniciar notification-service:',
      error.message
    );

    process.exit(1);
  }
}

iniciarServicio();