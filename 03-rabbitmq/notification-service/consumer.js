const pool = require('./db');

const esperar = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function validarEvento(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('El evento debe ser un objeto');
  }

  if (
    typeof event.eventId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.eventId)
  ) {
    throw new Error('eventId inválido');
  }

  if (event.type !== 'device.alert.triggered') {
    throw new Error('Tipo de evento no admitido');
  }

  for (const campo of ['deviceId', 'ownerId', 'usuarioId']) {
    if (
      !Number.isInteger(event[campo]) ||
      event[campo] <= 0 ||
      event[campo] > 2147483647
    ) {
      throw new Error(`${campo} inválido`);
    }
  }

  if (!['user', 'project'].includes(event.ownerType)) {
    throw new Error('ownerType inválido');
  }

  if (!['info', 'warning', 'critical'].includes(event.data?.level)) {
    throw new Error('Nivel de alerta inválido');
  }

  if (
    typeof event.data?.message !== 'string' ||
    !event.data.message.trim() ||
    event.data.message.length > 2000
  ) {
    throw new Error('Mensaje de alerta inválido');
  }

  const fecha = new Date(event.occurredAt);

  if (
    typeof event.occurredAt !== 'string' ||
    Number.isNaN(fecha.getTime()) ||
    fecha.getUTCFullYear() < 1000 ||
    fecha.getUTCFullYear() > 9999
  ) {
    throw new Error('occurredAt inválido');
  }

  return event;
}

async function guardarNotificacion(event) {
  try {
    await pool.execute(
      `INSERT INTO Notifications
        (eventId, eventType, deviceId, ownerType, ownerId,
         usuarioId, level, message, occurredAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.type,
        event.deviceId,
        event.ownerType,
        event.ownerId,
        event.usuarioId,
        event.data.level,
        event.data.message,
        new Date(event.occurredAt)
      ]
    );

    console.log(`Notificación guardada: ${event.eventId}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log(`Evento duplicado, no se vuelve a guardar: ${event.eventId}`);
      return;
    }

    throw err;
  }
}

// Conserva mensajes inválidos en otra cola.
// Espera la confirmación del broker antes de continuar.
function guardarRechazado(channel, queue, msg, motivo) {
  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      queue,
      msg.content,
      {
        persistent: true,
        contentType: 'application/json',
        headers: { motivo }
      },
      err => err ? reject(err) : resolve()
    );
  });
}

async function consumir(channel, queue, rejectedQueue) {
  await channel.consume(queue, msg => {
    if (!msg) return;

    procesar(msg).catch(err => {
      // Puede ocurrir si el canal se cierra durante el procesamiento.
      // Sin ACK, RabbitMQ puede volver a entregar el mensaje.
      console.error('Procesamiento interrumpido:', err.message);
    });
  }, { noAck: false });

  console.log(`Consumiendo alertas desde ${queue}`);

  async function procesar(msg) {
    try {
      let event;

      try {
        event = validarEvento(
          JSON.parse(msg.content.toString('utf8'))
        );
      } catch (err) {
        await guardarRechazado(
          channel,
          rejectedQueue,
          msg,
          err.message
        );

        channel.ack(msg);
        console.error(`Evento enviado a ${rejectedQueue}: ${err.message}`);
        return;
      }

      await guardarNotificacion(event);

      // También confirma duplicados que ya estaban guardados.
      channel.ack(msg);
    } catch (err) {
      console.error('No se pudo procesar la alerta:', err.message);

      await esperar(5000);

      // No se elimina: vuelve a la cola para otro intento.
      channel.nack(msg, false, true);
    }
  }
}

module.exports = { consumir };
