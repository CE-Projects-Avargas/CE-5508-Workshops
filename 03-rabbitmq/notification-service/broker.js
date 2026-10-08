const amqp = require('amqplib');
const exchange = process.env.RABBITMQ_EXCHANGE || 'devices.events';
const queue = process.env.RABBITMQ_QUEUE || 'notifications.devices';

async function conectar() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  // Docker reinicia el proceso y RabbitMQ reencola entregas sin ACK.
  connection.on('error', err => console.error('RabbitMQ:', err.message));
  connection.on('close', () => process.exit(1));
  const channel = await connection.createConfirmChannel();
  channel.on('error', err => console.error('Canal RabbitMQ:', err.message));
  channel.on('close', () => process.exit(1));
  await channel.assertExchange(exchange, 'topic', { durable: true });
  // El productor también crea la cola: funciona antes de iniciar el consumidor.
  await channel.assertQueue(`${queue}.dead`, { durable: true });
  await channel.assertQueue(queue, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': `${queue}.dead` }
  });
  for (const type of ['device.registered', 'device.alert.triggered']) {
    await channel.bindQueue(queue, exchange, type);
  }
  return channel;
}

function publicar(channel, event) {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, event.type, Buffer.from(JSON.stringify(event)), {
      persistent: true, contentType: 'application/json', messageId: event.eventId,
      type: event.type
    }, err => err ? reject(err) : resolve());
  });
}
module.exports = { conectar, publicar, queue };
