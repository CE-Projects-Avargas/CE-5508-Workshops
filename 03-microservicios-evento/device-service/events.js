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
 * Invalida las referencias cuando una conexión o canal deja de ser válido.
 */
function invalidarConexion(conexionCerrada, canalCerrado) {
  if (channel === canalCerrado) {
    channel = null;
  }

  if (connection === conexionCerrada) {
    connection = null;
  }
}

/**
 * Obtiene un canal de confirmación y declara el exchange.
 */
async function getChannel() {
  if (channel) {
    return channel;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    let nuevaConexion = null;
    let nuevoCanal = null;

    try {
      nuevaConexion = await amqp.connect(RABBITMQ_URL);

      nuevaConexion.on('error', (error) => {
        console.error(
          'Error en la conexión con RabbitMQ:',
          error.message
        );
      });

      nuevaConexion.on('close', () => {
        invalidarConexion(nuevaConexion, nuevoCanal);
        console.warn('La conexión con RabbitMQ se cerró');
      });

      nuevoCanal = await nuevaConexion.createConfirmChannel();

      nuevoCanal.on('error', (error) => {
        console.error(
          'Error en el canal de RabbitMQ:',
          error.message
        );
      });

      nuevoCanal.on('close', () => {
        invalidarConexion(nuevaConexion, nuevoCanal);
        console.warn('El canal de RabbitMQ se cerró');
      });

      await nuevoCanal.assertExchange(EVENTS_EXCHANGE, 'topic', {
        durable: true
      });

      connection = nuevaConexion;
      channel = nuevoCanal;

      return nuevoCanal;
    } catch (error) {
      if (nuevoCanal) {
        try {
          await nuevoCanal.close();
        } catch (_) {
          // El canal podría estar cerrado.
        }
      }

      if (nuevaConexion) {
        try {
          await nuevaConexion.close();
        } catch (_) {
          // La conexión podría estar cerrada.
        }
      }

      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Publica un evento persistente, espera la confirmación del broker
 * y detecta si RabbitMQ devuelve el mensaje por falta de destino.
 */
let colaPublicaciones = Promise.resolve();

function publicarEvento(routingKey, evento) {
  const publicar = async () => {
    const canal = await getChannel();
    const contenido = Buffer.from(JSON.stringify(evento));

    await new Promise((resolve, reject) => {
      let finalizado = false;

      const limpiar = () => {
        canal.removeListener('return', manejarRetorno);
        canal.removeListener('close', manejarCierre);
      };

      const terminar = (error) => {
        if (finalizado) {
          return;
        }

        finalizado = true;
        limpiar();

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const manejarRetorno = (mensaje) => {
        if (mensaje.properties.messageId !== evento.eventId) {
          return;
        }

        terminar(
          new Error(
            `RabbitMQ devolvió el evento ${evento.eventId}: ` +
            `${mensaje.fields.replyText || 'mensaje sin cola de destino'}`
          )
        );
      };

      const manejarCierre = () => {
        terminar(
          new Error(
            'El canal de RabbitMQ se cerró durante la publicación'
          )
        );
      };

      canal.on('return', manejarRetorno);
      canal.once('close', manejarCierre);

      try {
        canal.publish(
          EVENTS_EXCHANGE,
          routingKey,
          contenido,
          {
            persistent: true,
            mandatory: true,
            contentType: 'application/json',
            timestamp: Date.now(),
            messageId: evento.eventId
          },
          (error) => {
            if (error) {
              terminar(error);
              return;
            }

            terminar();
          }
        );
      } catch (error) {
        terminar(error);
      }
    });
  };

  const resultado = colaPublicaciones.then(publicar);

  // Un fallo no debe bloquear las publicaciones posteriores.
  colaPublicaciones = resultado.catch(() => {});

  return resultado;
}

module.exports = {
  publicarEvento
};
