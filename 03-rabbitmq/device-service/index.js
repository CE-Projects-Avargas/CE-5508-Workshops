const express = require('express');
const pool = require('./db');
const verificarToken = require('./auth');
const { createService } = require('./service');
const { createDispatcher } = require('./outbox');

async function start() {
  await pool.query('SELECT 1');
  // Persona 2 entrega un módulo con publicar(event). No abrimos conexiones AMQP aquí.
  const publisherPath = process.env.DEVICE_EVENT_PUBLISHER_MODULE;
  let dispatch = async () => {};
  if (publisherPath) {
    const publisher = require(require('node:path').resolve(__dirname, publisherPath));
    if (typeof publisher.publicar !== 'function') throw new Error('El módulo debe exportar publicar(event)');
    dispatch = createDispatcher(pool, event => publisher.publicar(event));
    await dispatch();
    setInterval(dispatch, 1000);
  } else {
    console.log('Publicador de Persona 2 pendiente: eventos guardados en Outbox, sin publicar.');
  }
  const service = createService(pool);
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', servicio: 'device-service' }));
  app.use('/devices', verificarToken);
  const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  app.post('/devices', route(async (req, res) => {
    const device = await service.register(req.body, req);
    res.status(201).json(device);
    void dispatch();
  }));
  app.get('/devices/:id', route(async (req, res) => res.json(await service.get(req.params.id, req))));
  app.post('/devices/:id/alerts', route(async (req, res) => {
    res.status(202).json(await service.alert(req.params.id, req.body, req));
    void dispatch();
  }));
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servicio' });
  });
  app.listen(process.env.PORT || 4003, () => console.log('device-service listo en :4003'));
}
start().catch(err => { console.error('No se pudo iniciar device-service:', err); process.exit(1); });
