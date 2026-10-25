const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Alert = require('../models/Alert');

// Todas estas rutas ya pasaron por verificarJWT: req.usuario es confiable.
//   401 -> no sabemos quien es (lo responde el middleware)
//   403 -> sabemos quien es, pero el dispositivo no es suyo
//   404 -> el dispositivo no existe

// Busca el dispositivo y comprueba que sea del usuario del token.
// Si algo falla ya responde (404 o 403) y devuelve null.
async function cargarDispositivoPropio(req, res) {
  const id = Number(req.params.id);
  const device = Number.isInteger(id) ? await Device.findByPk(id) : null;
  if (!device) {
    res.status(404).json({ error: 'dispositivo no encontrado' });
    return null;
  }
  if (device.ownerType !== 'user' || device.ownerId !== req.usuario.id) {
    res.status(403).json({ error: 'no tienes permiso sobre este dispositivo' });
    return null;
  }
  return device;
}

// POST /devices - {serial, nombre, ownerType, ownerId} -> 201
// El dueno real sale del TOKEN. Si el body pide otro ownerId, es 403.
router.post('/', async (req, res) => {
  try {
    const { serial, nombre, ownerType = 'user', ownerId } = req.body || {};
    if (!serial || !nombre) {
      return res.status(400).json({ error: 'serial y nombre son obligatorios' });
    }
    if (ownerType !== 'user') {
      return res.status(400).json({ error: 'por ahora solo ownerType "user"' });
    }
    if (ownerId !== undefined && Number(ownerId) !== req.usuario.id) {
      return res.status(403).json({ error: 'no puedes registrar dispositivos a nombre de otro usuario' });
    }

    const device = await Device.create({
      serial, nombre, ownerType: 'user', ownerId: req.usuario.id
    });
    res.status(201).json(device);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'ya existe un dispositivo con ese serial' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /devices/:id - 200 si es suyo, 403 si es ajeno, 404 si no existe
router.get('/:id', async (req, res) => {
  try {
    const device = await cargarDispositivoPropio(req, res);
    if (!device) return;
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /devices/:id/alerts - {level, message} -> 202
router.post('/:id/alerts', async (req, res) => {
  try {
    const device = await cargarDispositivoPropio(req, res);
    if (!device) return;

    const { level, message } = req.body || {};
    if (!['info', 'warning', 'critical'].includes(level)) {
      return res.status(400).json({ error: 'level debe ser info, warning o critical' });
    }
    if (typeof message !== 'string' || !message.trim() || message.length > 500) {
      return res.status(400).json({ error: 'message es obligatorio (maximo 500 caracteres)' });
    }

    const alert = await Alert.create({ deviceId: device.id, level, message });
    res.status(202).json({ status: 'accepted', alertId: alert.id, deviceId: device.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;