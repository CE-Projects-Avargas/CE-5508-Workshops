const amqp = require('amqplib');

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://taller3:taller3-local-only@localhost:5672';

const EVENTS_EXCHANGE =
  process.env.EVENTS_EXCHANGE || 'ce5508.events';

let connection = null;
let channel = null;
let connectionPromise = null;

/**
 * Obtiene un canal de RabbitMQ y declara el exchange de eventos.
 */
async function getChannel() {
  if (channel) {
    return channel;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      connection = await amqp.connect(RABBITMQ_URL);

      connection.on('error', (error) => {
        console.error('Error en la conexión con RabbitMQ:', error.message);
      });

      connection.on('close', () => {
        connection = null;
        channel = null;
        console.warn('La conexión con RabbitMQ se cerró');
      });

      channel = await connection.createConfirmChannel();

      channel.on('error', (error) => {
        console.error('Error en el canal de RabbitMQ:', error.message);
      });

      await channel.assertExchange(EVENTS_EXCHANGE, 'topic', {
        durable: true
      });

      return channel;
    } catch (error) {
      connection = null;
      channel = null;
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Publica un evento persistente y espera la confirmación del broker.
 */
async function publicarEvento(routingKey, evento) {
  const canal = await getChannel();

  const contenido = Buffer.from(JSON.stringify(evento));

  await new Promise((resolve, reject) => {
    canal.publish(
      EVENTS_EXCHANGE,
      routingKey,
      contenido,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        messageId: evento.eventId
      },
      (error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      }
    );
  });
}

module.exports = {
  publicarEvento
};
