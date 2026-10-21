const amqp = require('amqplib');

const { pool } = require('./db');

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbit:rabbit123@rabbitmq:5672';

const EXCHANGE = 'devices.events';
const QUEUE = 'notification.events';


// Guarda una notificación si el eventId no fue procesado antes.
async function registrarNotificacion(evento) {
  const {
    eventId,
    type,
    occurredAt,
    deviceId,
    ownerType,
    ownerId
  } = evento;

  try {
    await pool.execute(
      `
        INSERT INTO Notifications (
          event_id,
          type,
          device_id,
          owner_type,
          owner_id,
          occurred_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        eventId,
        type,
        deviceId,
        ownerType || null,
        ownerId || null,
        new Date(occurredAt)
      ]
    );

    console.log(
      `Notificación registrada para evento ${eventId}`
    );

  } catch (error) {
    // event_id es UNIQUE.
    // Si el evento ya fue procesado, no se crea otra notificación.
    if (error.code === 'ER_DUP_ENTRY') {
      console.log(
        `Evento duplicado ignorado: ${eventId}`
      );

      return;
    }

    throw error;
  }
}


// Inicia el consumidor de RabbitMQ.
async function iniciarConsumidor() {
  const conexion = await amqp.connect(RABBITMQ_URL);

  const canal = await conexion.createChannel();

  await canal.assertExchange(
    EXCHANGE,
    'topic',
    {
      durable: true
    }
  );

  await canal.assertQueue(
    QUEUE,
    {
      durable: true
    }
  );

  await canal.bindQueue(
    QUEUE,
    EXCHANGE,
    'device.registered'
  );

  await canal.bindQueue(
    QUEUE,
    EXCHANGE,
    'device.alert.triggered'
  );

  // Procesa un mensaje a la vez.
  await canal.prefetch(1);

  console.log(
    'notification-service conectado a RabbitMQ'
  );

  console.log(
    `Escuchando eventos en la cola ${QUEUE}`
  );

  canal.consume(
    QUEUE,
    async (mensaje) => {
      if (!mensaje) {
        return;
      }

      try {
        const evento = JSON.parse(
          mensaje.content.toString()
        );

        await registrarNotificacion(evento);

        // Solo confirma el mensaje después de procesarlo correctamente.
        canal.ack(mensaje);

      } catch (error) {
        console.error(
          'Error procesando evento:',
          error.message
        );

        // Error temporal: el mensaje vuelve a la cola para intentarlo después.
        canal.nack(
          mensaje,
          false,
          true
        );
      }
    }
  );
}


module.exports = {
  iniciarConsumidor
};