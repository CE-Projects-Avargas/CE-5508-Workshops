const amqp = require('amqplib');
const pool = require('./db');
const { consumir } = require('./consumer');

const esperar = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function iniciar() {
  while (true) {
    let connection;

    try {
      // Verifica que la tabla exista y que el usuario pueda leerla.
      await pool.query('SELECT id FROM Notifications LIMIT 1');
      console.log('Conexión con notification-db establecida');

      connection = await amqp.connect({
        protocol: 'amqp',
        hostname: process.env.RABBITMQ_HOST,
        port: Number(process.env.RABBITMQ_PORT || 5672),
        username: process.env.RABBITMQ_USER,
        password: process.env.RABBITMQ_PASSWORD,
        heartbeat: 10
      });

      connection.on('error', err => {
        console.error('Error de RabbitMQ:', err.message);
      });

      // Permite detectar el cierre y volver a conectarse.
      const cierre = new Promise(resolve => {
        connection.once('close', resolve);
      });

      const channel = await connection.createConfirmChannel();

      channel.on('error', err => {
        console.error('Error del canal:', err.message);
      });

      channel.once('close', () => {
        connection.close().catch(() => {});
      });

      const exchange = process.env.RABBITMQ_EXCHANGE;
      const queue = process.env.RABBITMQ_ALERT_QUEUE;

      await channel.assertExchange(exchange, 'topic', {
        durable: true
      });

      await channel.assertQueue(queue, {
        durable: true
      });

      await channel.bindQueue(
        queue,
        exchange,
        'device.alert.triggered'
      );

      await channel.prefetch(1);

      const rejectedQueue = 'alerts.rejected.queue';
      await channel.assertQueue(rejectedQueue, {
        durable: true
      });

      await consumir(channel, queue, rejectedQueue);

      await cierre;
      console.warn('Conexión cerrada; se intentará reconectar');
    } catch (err) {
      console.error('No se pudo conectar:', err.message);
    } finally {
      if (connection) {
        await connection.close().catch(() => {});
      }
    }

    await esperar(5000);
  }
}

iniciar().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
