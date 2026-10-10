// Es la librería que permite que Node.js hable con RabbitMQ mediante AMQP
const amqp = require('amqplib');

const config = {
  host: process.env.RABBITMQ_HOST || 'rabbitmq',
  port: Number(process.env.RABBITMQ_PORT || 5672),
  user: process.env.RABBITMQ_USER || 'taller3',
  password: process.env.RABBITMQ_PASSWORD || 'taller3_pass',

  exchange: process.env.RABBITMQ_EXCHANGE || 'device.events',

  registrationQueue:
    process.env.RABBITMQ_REGISTRATION_QUEUE || 'registrations.queue',

  alertQueue:
    process.env.RABBITMQ_ALERT_QUEUE || 'alerts.queue'
};

let connection = null;
let channel = null;
let connecting = null;

const EVENT_TYPES = new Set([
  'device.registered',
  'device.alert.triggered'
]);

async function crearCanal() {
  if (channel) {
    return channel;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    console.log(
      `Conectando con RabbitMQ en ${config.host}:${config.port}...`
    );

    const conn = await amqp.connect({
      protocol: 'amqp',
      hostname: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      heartbeat: 10
    });

    conn.on('error', err => {
      console.error('Error de conexión RabbitMQ:', err.message);
    });

    conn.on('close', () => {
      console.warn('Conexión RabbitMQ cerrada');
      connection = null;
      channel = null;
    });

    const ch = await conn.createConfirmChannel();

    ch.on('error', err => {
      console.error('Error de canal RabbitMQ:', err.message);
    });

    ch.on('close', () => {
      console.warn('Canal RabbitMQ cerrado');
      channel = null;
    });

    // Exchange donde crea device.events como tipo topic ya que se requiere enrutar el tipo del evento
    // Se le coloca assertExchange para que si no existe lo cree, y si ya existe no haga nada no duplica exchanges
    await ch.assertExchange(
      config.exchange,
      'topic',
      {
        durable: true
      }
    );

    // Cola de registros
    await ch.assertQueue(
      config.registrationQueue,
      {
        // la cola debe sobrevivir a reinicios de RabbitMQ, si RabbitMQ cae y se reinicia, la cola sigue existiendo 
        // y los mensajes que no se han consumido siguen ahí
        durable: true
      }
    );

    // Cola de alertas
    await ch.assertQueue(
      config.alertQueue,
      {
        // la cola debe sobrevivir a reinicios de RabbitMQ, si RabbitMQ cae y se reinicia, la cola sigue existiendo 
        // y los mensajes que no se han consumido siguen ahí
        durable: true
      }
    );

    // Bindings
    // Aquí si llega al exchange un mensaje con routing key device.registered, se enruta a la cola de registros
    await ch.bindQueue(
      config.registrationQueue,
      config.exchange,
      'device.registered'
    );

    // Aquí si llega al exchange un mensaje con routing key device.alert.triggered, se enruta a la cola de alertas
    await ch.bindQueue(
      config.alertQueue,
      config.exchange,
      'device.alert.triggered'
    );

    connection = conn;
    channel = ch;

    console.log('Topología RabbitMQ preparada:');
    console.log(`Exchange: ${config.exchange}`);
    console.log(
      `${config.registrationQueue} <- device.registered`
    );
    console.log(
      `${config.alertQueue} <- device.alert.triggered`
    );

    return ch;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}


function publicarConfirmado(ch, event) {
  return new Promise((resolve, reject) => {

    const contenido = Buffer.from(
      JSON.stringify(event)
    );

    // Publicamos el mensaje en el exchange con la routing key del tipo de evento
    ch.publish(
      config.exchange,
      event.type,
      contenido,
      {
        // El mensaje debe sobrevivir a reinicios de RabbitMQ, si RabbitMQ cae y se reinicia, el mensaje sigue existiendo en la cola
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId, // facilita la trazabilidad del mensaje, ya que podemos buscarlo en los logs de RabbitMQ
        // usamos eventId para mi compañera cuando reciba el evento, se hace la pregunta de si eventId existe en DB
        // si la respuesta es que si se hace el ack y de lo contrario se guarda notificación de que el evento 
        // ya fue procesado y se hace el ack y se aplica la idempotencia, para que no se procese el mismo evento dos veces
        type: event.type
      },
      err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}


async function publicar(event) {
  if (!event) {
    throw new Error('Evento requerido');
  }

  if (!event.eventId) {
    throw new Error('El evento no contiene eventId');
  }

  if (!event.type) {
    throw new Error('El evento no contiene type');
  }

  if (!EVENT_TYPES.has(event.type)) {
    throw new Error(
      `Tipo de evento no soportado: ${event.type}`
    );
  }

  try {
    const ch = await crearCanal();

    await publicarConfirmado(
      ch,
      event
    );

    console.log(
      `Evento publicado: ${event.type} (${event.eventId})`
    );

  } catch (err) {

    // Permitimos que el siguiente intento vuelva
    // a crear conexión/canal.
    channel = null;

    console.error(
      `No se pudo publicar ${event.type}:`,
      err.message
    );

    throw err;
  }
}


module.exports = {
  publicar
};