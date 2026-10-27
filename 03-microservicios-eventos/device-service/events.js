// Publicador de eventos hacia RabbitMQ.
//
//   exchange "device.events" (topic, durable)
//        |  routing key = tipo del evento (device.registered, device.alert.triggered)
//        v
//   cola "notification.events" (durable), enlazada con "device.#"
//
// device-service solo conoce el exchange. Declara tambien la cola para que
// ningun evento se pierda aunque notification-service todavia no haya arrancado
// (un exchange sin cola enlazada descarta los mensajes).
const amqp = require('amqplib');
const crypto = require('crypto');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://eventos:eventos123@rabbitmq:5672';
const EXCHANGE = 'device.events';
const COLA = 'notification.events';

let canal = null;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Conecta con reintentos. No bloquea el arranque del servicio: si RabbitMQ
// todavia no esta listo, la API sigue funcionando y reintenta en segundo plano.
async function conectar() {
  for (;;) {
    try {
      const conexion = await amqp.connect(RABBITMQ_URL);
      conexion.on('error', (err) => console.error('RabbitMQ error:', err.message));
      conexion.on('close', () => {
        console.error('RabbitMQ cerro la conexion, reconectando...');
        canal = null;
        conectar();
      });

      // Canal con confirmaciones: el broker avisa cuando recibio cada mensaje.
      const ch = await conexion.createConfirmChannel();
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      await ch.assertQueue(COLA, { durable: true });
      await ch.bindQueue(COLA, EXCHANGE, 'device.#');

      canal = ch;
      console.log('Conectado a RabbitMQ, publicando en el exchange', EXCHANGE);
      return;
    } catch (err) {
      console.error('No se pudo conectar a RabbitMQ, reintentando en 3s:', err.message);
      await dormir(3000);
    }
  }
}

// Publica un evento con el formato acordado:
//   { eventId, type, occurredAt, deviceId, userId, ownerType, ownerId, data }
// userId es quien hizo la accion; ownerType + ownerId, el dueno del
// dispositivo (un usuario o un proyecto).
// Resuelve cuando RabbitMQ confirma que lo recibio.
async function publicarEvento(type, { deviceId, userId, ownerType, ownerId, data }) {
  if (!canal) throw new Error('RabbitMQ no disponible');

  const evento = {
    eventId: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    deviceId,
    userId,
    ownerType,
    ownerId,
    data
  };

  await new Promise((resolve, reject) => {
    canal.publish(
      EXCHANGE,
      type,                                   // routing key
      Buffer.from(JSON.stringify(evento)),
      { persistent: true, contentType: 'application/json', messageId: evento.eventId, type },
      (err) => (err ? reject(err) : resolve())
    );
  });

  return evento;
}

module.exports = { conectar, publicarEvento };