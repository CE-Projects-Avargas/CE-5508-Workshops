// Prueba de idempotencia: publica dos veces el mismo evento y cuenta cuantas notificaciones quedaron con ese eventId
// Uso: docker compose exec notification-service node reenviar.js [eventId]
const amqp = require('amqplib');
const { randomUUID } = require('crypto');
const db = require('./db');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://taller3:taller3-local-only@localhost:5672';
const EXCHANGE = process.env.EVENTS_EXCHANGE || 'ce5508.events';

async function main() {
  const eventId = process.argv[2] || randomUUID();
  const evento = {
    eventId,
    type: 'device.alert.triggered',
    occurredAt: new Date().toISOString(),
    deviceId: 1,
    ownerType: 'user',
    ownerId: 1,
    data: { level: 'info', message: 'Prueba de evento repetido' }
  };

  const conexion = await amqp.connect(RABBITMQ_URL);
  const canal = await conexion.createConfirmChannel();
  const contenido = Buffer.from(JSON.stringify(evento));
  for (let i = 0; i < 2; i++) {
    canal.publish(EXCHANGE, evento.type, contenido, {
      persistent: true,
      contentType: 'application/json',
      messageId: eventId
    });
  }
  await canal.waitForConfirms();
  console.log(`Evento ${eventId} publicado 2 veces`);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const [filas] = await db.query('SELECT COUNT(*) AS total FROM Notificaciones WHERE eventId = ?', [eventId]);
  console.log(`Notificaciones con ese eventId: ${filas[0].total}`);

  await canal.close();
  await conexion.close();
  await db.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
