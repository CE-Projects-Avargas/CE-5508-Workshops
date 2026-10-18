const { randomUUID } = require('crypto');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function positiveId(value) {
  return (typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value))) &&
    Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
}
function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function validateDevice(body) {
  if (!body || !text(body.serial, 64) || !text(body.nombre, 255) ||
      !['user', 'project'].includes(body.ownerType) || !positiveId(body.ownerId)) {
    throw new HttpError(400, 'Se requieren serial (1–64), nombre (1–255), ownerType (user/project) y ownerId entero positivo');
  }
  return { serial: body.serial.trim(), nombre: body.nombre.trim(), ownerType: body.ownerType, ownerId: Number(body.ownerId) };
}
function validateAlert(body) {
  if (!body || !['info', 'warning', 'critical'].includes(body.level) || !text(body.message, 2000)) {
    throw new HttpError(400, 'Se requieren level (info/warning/critical) y message (1–2000 caracteres)');
  }
  return { level: body.level, message: body.message.trim() };
}
function makeEvent(type, device, userId, data) {
  return { eventId: randomUUID(), type, occurredAt: new Date().toISOString(),
    deviceId: device.id, ownerType: device.ownerType, ownerId: device.ownerId,
    usuarioId: Number(userId), data };
}
async function authorize(owner, req, fetchImpl = fetch) {
  if (owner.ownerType === 'user') {
    if (Number(owner.ownerId) !== Number(req.usuario.id)) throw new HttpError(403, 'Dispositivo de otro usuario');
    return;
  }
  let response;
  try {
    response = await fetchImpl(`${process.env.BACKEND_URL || 'http://backend:4000'}/proyectos/${owner.ownerId}`, {
      headers: { Authorization: req.headers.authorization }, signal: AbortSignal.timeout(5000)
    });
  } catch { throw new HttpError(503, 'No se pudo verificar el proyecto'); }
  if ([401, 403, 404].includes(response.status)) throw new HttpError(response.status, 'No tiene acceso al proyecto solicitado');
  if (!response.ok) throw new HttpError(503, 'No se pudo verificar el proyecto');
  let project;
  try { project = await response.json(); } catch { throw new HttpError(503, 'Respuesta inválida del backend'); }
  if (Number(project.id) !== Number(owner.ownerId) || Number(project.ownerId) !== Number(req.usuario.id)) {
    throw new HttpError(403, 'Proyecto de otro usuario');
  }
}
async function saveEvent(connection, event) {
  await connection.execute('INSERT INTO Outbox (eventId, payload) VALUES (?, ?)', [event.eventId, JSON.stringify(event)]);
}
function createService(pool) {
  return {
    async register(body, req) {
      const device = validateDevice(body);
      await authorize(device, req);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          'INSERT INTO Devices (serial, nombre, ownerType, ownerId) VALUES (?, ?, ?, ?)',
          [device.serial, device.nombre, device.ownerType, device.ownerId]);
        device.id = result.insertId;
        await saveEvent(connection, makeEvent('device.registered', device, req.usuario.id, { serial: device.serial, nombre: device.nombre }));
        await connection.commit();
        return device;
      } catch (err) {
        await connection.rollback();
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Serial ya registrado');
        throw err;
      } finally { connection.release(); }
    },
    async get(id, req) {
      if (!positiveId(id)) throw new HttpError(400, 'ID inválido');
      const [rows] = await pool.execute('SELECT * FROM Devices WHERE id = ?', [Number(id)]);
      if (!rows.length) throw new HttpError(404, 'Dispositivo no encontrado');
      await authorize(rows[0], req);
      return rows[0];
    },
    async alert(id, body, req) {
      const data = validateAlert(body);
      const device = await this.get(id, req);
      const event = makeEvent('device.alert.triggered', device, req.usuario.id, data);
      await saveEvent(pool, event);
      return { eventId: event.eventId, mensaje: 'Alerta aceptada para publicación' };
    }
  };
}
module.exports = { HttpError, positiveId, validateDevice, validateAlert, makeEvent, authorize, createService };
