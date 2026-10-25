// Consumidor de eventos desde RabbitMQ.
//
//   exchange "device.events" --(device.#)--> cola "notification.events"
//                                                   |
//                                          notification-service
//     guardado o repetido ......................... ack (sale de la cola)
//     error temporal (p. ej. notification-db caida)  -> "notification.events.retry"
//                                                       espera 5 s y vuelve sola a la cola
//     mensaje invalido o se agotaron los intentos   -> "notification.events.dlq"
//
// - ack manual: el mensaje solo sale de la cola DESPUES de guardarse en
//   notification-db. Si el servicio muere a la mitad, RabbitMQ lo vuelve a entregar.
// - Idempotente: eventId es UNIQUE en notification-db, un repetido no se duplica.
// - Nada se pierde en silencio: lo que no se pudo procesar queda en la DLQ,
//   visible en el panel (localhost:15672).
const amqp = require('amqplib');
const Notificacion = require('./models/Notificacion');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://eventos:eventos123@rabbitmq:5672';
const EXCHANGE = 'device.events';
const COLA = 'notification.events';
const COLA_REINTENTOS = 'notification.events.retry';
const COLA_FALLIDOS = 'notification.events.dlq';
// Es un argumento de la cola: cambiarlo exige borrar la cola de reintentos antes.
const ESPERA_REINTENTO_MS = 5000;
const MAX_INTENTOS = Number(process.env.MAX_INTENTOS) || 10;

let canal = null;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Conecta con reintentos y empieza a consumir. Si RabbitMQ se cae, vuelve a
// conectar solo; los mensajes sin ack los devuelve RabbitMQ a la cola.
async function conectar() {
  for (;;) {
    let conexion = null;
    try {
      conexion = await amqp.connect(RABBITMQ_URL);
      conexion.on('error', (err) => console.error('RabbitMQ error:', err.message));

      const ch = await conexion.createConfirmChannel();
      ch.on('error', (err) => console.error('RabbitMQ error en el canal:', err.message));

      // Misma declaracion que device-service: si fuera distinta, RabbitMQ la rechaza.
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      await ch.assertQueue(COLA, { durable: true });
      await ch.bindQueue(COLA, EXCHANGE, 'device.#');

      // Cola de espera, sin consumidores: al vencer el TTL, RabbitMQ manda el
      // mensaje por el exchange por defecto ('') directo de vuelta a COLA.
      await ch.assertQueue(COLA_REINTENTOS, {
        durable: true,
        arguments: {
          'x-message-ttl': ESPERA_REINTENTO_MS,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': COLA
        }
      });
      await ch.assertQueue(COLA_FALLIDOS, { durable: true });

      // De a uno: el siguiente mensaje llega cuando se confirma el actual.
      await ch.prefetch(1);
      // Red de seguridad: un error no previsto no debe tumbar el proceso. El
      // mensaje queda sin ack y RabbitMQ lo vuelve a entregar.
      await ch.consume(COLA, (msg) => procesar(ch, msg).catch((err) => {
        console.error('Error procesando un mensaje, RabbitMQ lo volvera a entregar:', err.message);
      }), { noAck: false });

      // Con todo listo se engancha la reconexion. Si muere solo el canal,
      // se cierra la conexion para pasar por el mismo camino.
      ch.on('close', () => conexion.close().catch(() => {}));
      conexion.on('close', () => {
        console.error('RabbitMQ cerro la conexion, reconectando...');
        canal = null;
        conectar();
      });

      canal = ch;
      console.log(`Conectado a RabbitMQ, consumiendo de la cola ${COLA}`);
      return;
    } catch (err) {
      if (conexion) conexion.close().catch(() => {});
      console.error('No se pudo conectar a RabbitMQ, reintentando en 3s:', err.message);
      await dormir(3000);
    }
  }
}

async function procesar(ch, msg) {
  // RabbitMQ cancelo el consumidor (p. ej. borraron la cola): reconectar.
  if (msg === null) {
    console.error(`RabbitMQ cancelo el consumo de ${COLA}, reconectando...`);
    ch.close().catch(() => {});
    return;
  }

  const intentos = Number((msg.properties.headers || {})['x-intentos']) || 0;

  let evento;
  try {
    evento = JSON.parse(msg.content.toString());
  } catch {
    return apartar(ch, msg, intentos, 'el mensaje no es JSON valido');
  }
  const invalido = validar(evento);
  if (invalido) return apartar(ch, msg, intentos, invalido);

  let nueva;
  try {
    nueva = await registrar(evento, msg.content.toString());
  } catch (err) {
    // Error temporal: no se descarta. Va a la cola de espera para reintentarlo,
    // o a la DLQ si ya se agotaron los intentos.
    if (intentos + 1 >= MAX_INTENTOS) return apartar(ch, msg, intentos + 1, err.message);
    console.error(`[${evento.type}] ${evento.eventId} -> error temporal (${err.message}), ` +
      `reintento ${intentos + 1}/${MAX_INTENTOS - 1} en ${ESPERA_REINTENTO_MS / 1000}s`);
    return mover(ch, msg, COLA_REINTENTOS, { 'x-intentos': intentos + 1, 'x-motivo': err.message });
  }

  console.log(nueva
    ? `[${evento.type}] ${evento.eventId} -> notificacion registrada`
    : `[${evento.type}] ${evento.eventId} -> repetido, ya estaba registrado (se ignora)`);
  ch.ack(msg);
}

// Los campos minimos que exige el enunciado, con el tipo que espera la tabla.
// Devuelve el motivo si el evento no sirve, o null si esta bien.
function validar(evento) {
  if (!evento || typeof evento !== 'object') return 'el evento no es un objeto';
  const faltan = ['eventId', 'type', 'occurredAt', 'deviceId', 'userId']
    .filter((c) => evento[c] === undefined || evento[c] === null);
  if (faltan.length) return `faltan campos: ${faltan.join(', ')}`;
  if (typeof evento.eventId !== 'string' || !evento.eventId || evento.eventId.length > 36) {
    return 'eventId invalido';
  }
  if (typeof evento.type !== 'string') return 'type debe ser texto';
  if (!Number.isInteger(evento.deviceId) || !Number.isInteger(evento.userId)) {
    return 'deviceId y userId deben ser enteros';
  }
  if (Number.isNaN(Date.parse(evento.occurredAt))) return 'occurredAt no es una fecha';
  return null;
}

function textoDe(evento) {
  const d = evento.data || {};
  switch (evento.type) {
    case 'device.registered':
      return `Se registro el dispositivo "${d.nombre}" (serial ${d.serial})`;
    case 'device.alert.triggered':
      return `Alerta ${d.level} en el dispositivo ${evento.deviceId}: ${d.message}`;
    default:
      return `Evento ${evento.type} del dispositivo ${evento.deviceId}`;
  }
}

// true = notificacion nueva, false = ese eventId ya estaba (repetido).
// No se pregunta antes "ya existe?": el UNIQUE de la tabla es el que decide,
// asi ni dos entregas simultaneas pueden duplicarla.
async function registrar(evento, payload) {
  try {
    await Notificacion.create({
      eventId: evento.eventId,
      type: evento.type,
      deviceId: evento.deviceId,
      userId: evento.userId,
      mensaje: textoDe(evento).slice(0, 700),
      payload,
      occurredAt: evento.occurredAt
    });
    return true;
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return false;
    throw err;
  }
}

// Un mensaje que no se puede procesar se aparta en la DLQ con el motivo.
function apartar(ch, msg, intentos, motivo) {
  console.error(`Mensaje ${msg.properties.messageId || '(sin id)'} enviado a ${COLA_FALLIDOS}: ${motivo}`);
  return mover(ch, msg, COLA_FALLIDOS, { 'x-intentos': intentos, 'x-motivo': motivo });
}

// Copia el mensaje a otra cola y, solo cuando RabbitMQ confirma que la recibio,
// hace ack del original. Si algo falla antes del ack, el original sigue en la
// cola: en el peor caso llega repetido, y eso ya lo resuelve el eventId.
async function mover(ch, msg, cola, headers) {
  try {
    await new Promise((resolve, reject) => {
      ch.sendToQueue(cola, msg.content, {
        persistent: true,
        contentType: msg.properties.contentType,
        messageId: msg.properties.messageId,
        type: msg.properties.type,
        headers
      }, (err) => (err ? reject(err) : resolve()));
    });
    ch.ack(msg);
  } catch (err) {
    console.error(`No se pudo mover el mensaje a ${cola}, se devuelve a ${COLA}:`, err.message);
    await dormir(3000);
    try {
      ch.nack(msg, false, true);
    } catch {
      // Canal cerrado: RabbitMQ devuelve solo los mensajes sin ack.
    }
  }
}

const consumiendo = () => canal !== null;

module.exports = { conectar, consumiendo };
