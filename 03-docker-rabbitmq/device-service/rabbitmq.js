const amqp = require('amqplib');

let conexion = null;
let canal = null;

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbit:rabbit123@rabbitmq:5672';

const EXCHANGE = 'devices.events';


// Conecta device-service con RabbitMQ.
async function conectarRabbitMQ() {
  conexion = await amqp.connect(RABBITMQ_URL);

  canal = await conexion.createChannel();

  await canal.assertExchange(
    EXCHANGE,
    'topic',
    {
      durable: true
    }
  );

  console.log('device-service conectado a RabbitMQ');
}


// Publica un evento en el exchange de dispositivos.
async function publicarEvento(tipo, evento) {
  if (!canal) {
    throw new Error('RabbitMQ no está conectado');
  }

  const mensaje = Buffer.from(
    JSON.stringify(evento)
  );

  canal.publish(
    EXCHANGE,
    tipo,
    mensaje,
    {
      persistent: true,
      contentType: 'application/json'
    }
  );
}


module.exports = {
  conectarRabbitMQ,
  publicarEvento
};