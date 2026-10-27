const http = require('http');
const sequelize = require('./db');
const { conectar, consumiendo } = require('./consumidor');

// Sin API publica (el enunciado lo permite): notification-service solo reacciona
// a eventos de RabbitMQ. Este GET / existe para el healthcheck de Docker:
// sano = conectado a RabbitMQ y consumiendo la cola.
const salud = http.createServer((req, res) => {
  const ok = consumiendo();
  res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: ok ? 'ok' : 'sin conexion a RabbitMQ',
    servicio: 'CE5508 - notification-service Taller 3'
  }));
});

const PORT = process.env.PORT || 4200;

async function start() {
  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      await sequelize.authenticate();
      console.log('Conexion a notification-db establecida');
      break;
    } catch (err) {
      intentos++;
      console.log(`No se pudo conectar a la BD (intento ${intentos}/${maxIntentos}), reintentando en 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // RabbitMQ conecta en segundo plano (con reintentos), sin frenar el arranque.
  conectar();

  // Sin sequelize.sync(): el esquema lo crea notification-db/init/*.sql
  salud.listen(PORT, () => {
    console.log(`notification-service corriendo en http://localhost:${PORT} (solo healthcheck)`);
  });
}

start();
