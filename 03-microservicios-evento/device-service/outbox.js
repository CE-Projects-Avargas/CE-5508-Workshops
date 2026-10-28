// Outbox transaccional: los eventos se guardan en device-db junto al cambio y se publican despues, con reintentos
const db = require('./db');
const { publicarEvento } = require('./events');

const INTERVALO_MS = Number(process.env.OUTBOX_INTERVAL_MS || 2000);
const LOTE = 50;

let corriendo = false;
let otraVuelta = false;

// Recibe la conexion de la transaccion para que el evento quede o no junto con el cambio
async function encolarEvento(conexion, evento) {
  await conexion.execute(
    'INSERT INTO EventosPendientes (eventId, routingKey, payload) VALUES (?, ?, ?)',
    [evento.eventId, evento.type, JSON.stringify(evento)]
  );
}

async function publicarLote() {
  const [filas] = await db.query(
    `SELECT id, eventId, routingKey, payload FROM EventosPendientes
     WHERE publicadoEn IS NULL ORDER BY id LIMIT ${LOTE}`
  );

  for (const fila of filas) {
    const evento = typeof fila.payload === 'string' ? JSON.parse(fila.payload) : fila.payload;
    try {
      await publicarEvento(fila.routingKey, evento);
    } catch (err) {
      // Se corta el lote para no adelantar eventos posteriores; se reintenta en la proxima vuelta
      await db.execute(
        'UPDATE EventosPendientes SET intentos = intentos + 1, ultimoError = ? WHERE id = ?',
        [String(err.message).slice(0, 500), fila.id]
      );
      console.error(`Evento ${fila.eventId} pendiente, se reintentara: ${err.message}`);
      return false;
    }
    // Si esto falla tras publicar, el evento sale otra vez; notification-service lo descarta por eventId
    await db.execute('UPDATE EventosPendientes SET publicadoEn = CURRENT_TIMESTAMP(3) WHERE id = ?', [fila.id]);
  }
  return filas.length === LOTE;
}

async function publicarPendientes() {
  if (corriendo) {
    otraVuelta = true;
    return;
  }
  corriendo = true;
  try {
    do {
      otraVuelta = false;
      if (await publicarLote()) otraVuelta = true;
    } while (otraVuelta);
  } catch (err) {
    console.error('Error revisando la outbox:', err.message);
  } finally {
    corriendo = false;
  }
}

function iniciarOutbox() {
  setInterval(publicarPendientes, INTERVALO_MS);
  publicarPendientes();
}

module.exports = { encolarEvento, publicarPendientes, iniciarOutbox };
