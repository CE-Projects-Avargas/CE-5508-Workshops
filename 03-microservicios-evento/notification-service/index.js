// Arranque de notification-service: no expone API, solo consume eventos de RabbitMQ
const { iniciar, detener } = require('./consumidor');

iniciar().catch((err) => {
  console.error('No se pudo iniciar notification-service:', err.message);
  process.exit(1);
});

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => detener().finally(() => process.exit(0)));
}
