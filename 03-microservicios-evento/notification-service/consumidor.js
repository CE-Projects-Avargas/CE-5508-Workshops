// Consumidor de eventos: una notificacion por evento, ack solo despues de guardar y sin duplicar por eventId
const amqp = require('amqplib');
const db = require('./db');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://taller3:taller3-local-only@localhost:5672';
const EXCHANGE = process.env.EVENTS_EXCHANGE || 'ce5508.events';
const COLA = process.env.EVENTS_QUEUE || 'notifications';
const EXCHANGE_DLX = `${EXCHANGE}.dlx`;
const COLA_DLQ = `${COLA}.dlq`;
const TIPOS = ['device.registered', 'device.alert.triggered'];
const ESPERA_REINTENTO_MS = Number(process.env.RETRY_DELAY_MS || 5000);

let conexion = null;
let canal = null;
let deteniendo = false;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class EventoInvalido extends Error {}

function enteroPositivo(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

function validarEvento(evento) {
  if (!evento || typeof evento !== 'object') throw new EventoInvalido('El mensaje no es un objeto JSON');
  if (typeof evento.eventId !== 'string' || !evento.eventId.trim() || evento.eventId.length > 64) {
    throw new EventoInvalido('eventId invalido');
  }
  if (!TIPOS.includes(evento.type)) throw new EventoInvalido(`type desconocido: ${evento.type}`);
  if (Number.isNaN(Date.parse(evento.occurredAt))) throw new EventoInvalido('occurredAt invalido');
  if (enteroPositivo(evento.deviceId) === null) throw new EventoInvalido('deviceId invalido');
  if (evento.ownerType != null && !['user', 'project'].includes(evento.ownerType)) {
    throw new EventoInvalido('ownerType invalido');
  }
  if (enteroPositivo(evento.ownerId) === null && enteroPositivo(evento.userId) === null) {
    throw new EventoInvalido('Falta la referencia al usuario o proyecto');
  }
  return evento;
}

function textoNotificacion(evento) {
  const datos = evento.data || {};
  const texto = evento.type === 'device.registered'
    ? `Dispositivo ${datos.nombre || evento.deviceId} (${datos.serial || 'sin serial'}) registrado`
    : `Alerta ${datos.level || ''}: ${datos.message || ''}`;
  return texto.slice(0, 500);
}

// Devuelve false si el eventId ya estaba guardado (evento repetido)
async function guardarNotificacion(evento) {
  const datos = evento.data || {};
  try {
    await db.execute(
      `INSERT INTO Notificaciones
         (eventId, tipo, deviceId, ownerType, ownerId, nivel, mensaje, payload, ocurridoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evento.eventId,
        evento.type,
        enteroPositivo(evento.deviceId),
        evento.ownerType ?? null,
        enteroPositivo(evento.ownerId),
        datos.level ? String(datos.level).slice(0, 32) : null,
        textoNotificacion(evento),
        JSON.stringify(evento),
        new Date(evento.occurredAt)
      ]
    );
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
}

// SQLSTATE 22xxx (dato invalido) y 23xxx (restriccion) no se arreglan reintentando
function esErrorPermanente(err) {
  return typeof err.sqlState === 'string' && /^2[23]/.test(err.sqlState);
}

async function procesar(msg) {
  if (!msg) return;

  let evento;
  try {
    evento = validarEvento(JSON.parse(msg.content.toString('utf8')));
  } catch (err) {
    console.error(`Mensaje invalido enviado a ${COLA_DLQ}: ${err.message}`);
    return canal.nack(msg, false, false);
  }

  try {
    const nueva = await guardarNotificacion(evento);
    console.log(nueva
      ? `Notificacion registrada: ${evento.type} ${evento.eventId}`
      : `Evento repetido ignorado: ${evento.eventId}`);
    canal.ack(msg);
  } catch (err) {
    if (esErrorPermanente(err)) {
      console.error(`No se pudo guardar ${evento.eventId}, enviado a ${COLA_DLQ}: ${err.message}`);
      return canal.nack(msg, false, false);
    }
    // Error temporal (p. ej. la BD no responde): sin ack, vuelve a la cola despues de esperar
    console.error(`Error temporal con ${evento.eventId}, reintento en ${ESPERA_REINTENTO_MS} ms: ${err.message}`);
    await esperar(ESPERA_REINTENTO_MS);
    canal.nack(msg, false, true);
  }
}

async function conReintentos(nombre, fn, intentos = 20) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= intentos) throw err;
      console.log(`${nombre} no disponible (${i}/${intentos}): ${err.message}`);
      await esperar(3000);
    }
  }
}

async function iniciar() {
  deteniendo = false;
  await conReintentos('MariaDB', () => db.query('SELECT 1'));

  conexion = await conReintentos('RabbitMQ', () => amqp.connect(RABBITMQ_URL));
  conexion.on('error', (err) => console.error('Error en la conexion con RabbitMQ:', err.message));
  conexion.on('close', () => {
    if (deteniendo) return;
    // Docker (restart: unless-stopped) levanta el servicio de nuevo; lo no confirmado sigue en la cola
    console.error('Se perdio la conexion con RabbitMQ, se reinicia el servicio');
    process.exit(1);
  });

  canal = await conexion.createChannel();

  // La cola es durable y la declara el consumidor: los eventos esperan aunque el servicio este detenido
  await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
  await canal.assertExchange(EXCHANGE_DLX, 'fanout', { durable: true });
  await canal.assertQueue(COLA_DLQ, { durable: true });
  await canal.bindQueue(COLA_DLQ, EXCHANGE_DLX, '');
  await canal.assertQueue(COLA, { durable: true, arguments: { 'x-dead-letter-exchange': EXCHANGE_DLX } });
  for (const tipo of TIPOS) await canal.bindQueue(COLA, EXCHANGE, tipo);

  // De a un mensaje: mientras uno se reintenta no se adelantan los siguientes
  await canal.prefetch(1);
  await canal.consume(COLA, (msg) => {
    procesar(msg).catch((err) => console.error('Error procesando mensaje:', err.message));
  }, { noAck: false });

  console.log(`notification-service escuchando la cola ${COLA}`);
}

async function detener() {
  deteniendo = true;
  try {
    if (canal) await canal.close();
    if (conexion) await conexion.close();
  } catch (_) {
    // ya estaba cerrada
  }
}

module.exports = { iniciar, detener, validarEvento };
