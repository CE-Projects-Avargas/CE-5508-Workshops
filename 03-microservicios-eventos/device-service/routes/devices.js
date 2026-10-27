const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const { publicarEvento } = require('../events');
const { duenoDelProyecto, proyectosDe } = require('../proyectos');

// Todas estas rutas ya pasaron por verificarJWT: req.usuario es confiable.
//   401 -> no sabemos quien es (lo responde el middleware)
//   403 -> sabemos quien es, pero el dispositivo no es suyo
//   404 -> el dispositivo no existe
//
// Un dispositivo pertenece a un usuario (ownerType "user") o a un proyecto
// (ownerType "project"). Puede verlo o modificarlo:
//   - de un usuario: ese mismo usuario.
//   - de un proyecto: el dueno del proyecto (lo dice backend).

// Publica un evento sin romper la respuesta HTTP: el dato ya quedo guardado en
// device-db, asi que si RabbitMQ falla solo se registra el error en el log.
// (Limitacion conocida: para garantizarlo haria falta un patron "outbox".)
async function publicarSinFallar(type, datos) {
  try {
    return await publicarEvento(type, datos);
  } catch (err) {
    console.error(`No se pudo publicar ${type}:`, err.message);
    return null;
  }
}

// Responde el error: 503 si backend no respondio, 500 si fue otra cosa.
function responderError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

// true si el usuario del token puede ver o modificar el dispositivo.
async function puedeAcceder(device, req) {
  if (device.ownerType === 'user') return device.ownerId === req.usuario.id;
  const dueno = await duenoDelProyecto(device.ownerId, req.headers.authorization);
  return dueno === req.usuario.id;
}

// Busca el dispositivo y comprueba que el usuario tenga permiso sobre el.
// Si algo falla ya responde (404 o 403) y devuelve null.
async function cargarDispositivoPermitido(req, res) {
  const id = Number(req.params.id);
  const device = Number.isInteger(id) ? await Device.findByPk(id) : null;
  if (!device) {
    res.status(404).json({ error: 'dispositivo no encontrado' });
    return null;
  }
  if (!(await puedeAcceder(device, req))) {
    res.status(403).json({ error: 'no tienes permiso sobre este dispositivo' });
    return null;
  }
  return device;
}

// Referencia al dueno que viaja en cada evento.
const dueno = (device) => ({ ownerType: device.ownerType, ownerId: device.ownerId });

// GET /devices - los dispositivos propios y los de los proyectos propios
router.get('/', async (req, res) => {
  try {
    const proyectos = await proyectosDe(req.usuario.id, req.headers.authorization);
    const devices = await Device.findAll({
      where: {
        [Op.or]: [
          { ownerType: 'user', ownerId: req.usuario.id },
          ...(proyectos.length ? [{ ownerType: 'project', ownerId: proyectos }] : [])
        ]
      },
      order: [['createdAt', 'DESC']]
    });
    res.json(devices);
  } catch (err) {
    responderError(res, err);
  }
});

// POST /devices - {serial, nombre, ownerType, ownerId} -> 201
//   ownerType "user":    ownerId es el usuario del token (si el body pide otro, 403).
//   ownerType "project": ownerId es un proyecto del que el usuario es dueno (si no, 403).
router.post('/', async (req, res) => {
  try {
    const { serial, nombre, ownerType = 'user', ownerId } = req.body || {};
    if (!serial || !nombre) {
      return res.status(400).json({ error: 'serial y nombre son obligatorios' });
    }

    let idDueno;
    if (ownerType === 'user') {
      if (ownerId !== undefined && Number(ownerId) !== req.usuario.id) {
        return res.status(403).json({ error: 'no puedes registrar dispositivos a nombre de otro usuario' });
      }
      idDueno = req.usuario.id;
    } else if (ownerType === 'project') {
      idDueno = Number(ownerId);
      if (!Number.isInteger(idDueno) || idDueno <= 0) {
        return res.status(400).json({ error: 'ownerId debe ser el id de un proyecto' });
      }
      const duenoProyecto = await duenoDelProyecto(idDueno, req.headers.authorization);
      if (duenoProyecto === null) {
        return res.status(400).json({ error: 'el proyecto no existe' });
      }
      if (duenoProyecto !== req.usuario.id) {
        return res.status(403).json({ error: 'no eres el dueno de ese proyecto' });
      }
    } else {
      return res.status(400).json({ error: 'ownerType debe ser "user" o "project"' });
    }

    const device = await Device.create({ serial, nombre, ownerType, ownerId: idDueno });

    await publicarSinFallar('device.registered', {
      deviceId: device.id,
      userId: req.usuario.id,
      ...dueno(device),
      data: { serial: device.serial, nombre: device.nombre }
    });

    res.status(201).json(device);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'ya existe un dispositivo con ese serial' });
    }
    responderError(res, err);
  }
});

// GET /devices/:id - 200 si tiene permiso, 403 si no, 404 si no existe
router.get('/:id', async (req, res) => {
  try {
    const device = await cargarDispositivoPermitido(req, res);
    if (!device) return;
    res.json(device);
  } catch (err) {
    responderError(res, err);
  }
});

// POST /devices/:id/alerts - {level, message} -> 202
router.post('/:id/alerts', async (req, res) => {
  try {
    const device = await cargarDispositivoPermitido(req, res);
    if (!device) return;

    const { level, message } = req.body || {};
    if (!['info', 'warning', 'critical'].includes(level)) {
      return res.status(400).json({ error: 'level debe ser info, warning o critical' });
    }
    if (typeof message !== 'string' || !message.trim() || message.length > 500) {
      return res.status(400).json({ error: 'message es obligatorio (maximo 500 caracteres)' });
    }

    const alert = await Alert.create({ deviceId: device.id, level, message });

    const evento = await publicarSinFallar('device.alert.triggered', {
      deviceId: device.id,
      userId: req.usuario.id,
      ...dueno(device),
      data: { alertId: alert.id, level, message }
    });

    res.status(202).json({
      status: 'accepted',
      alertId: alert.id,
      deviceId: device.id,
      eventId: evento ? evento.eventId : null
    });
  } catch (err) {
    responderError(res, err);
  }
});

module.exports = router;
