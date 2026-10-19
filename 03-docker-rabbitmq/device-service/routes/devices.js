const express = require('express');

const router = express.Router();

const verificarToken = require('../middleware/verificarToken');

const {
  crearDevice,
  obtenerDevicePorId
} = require('../models/Device');


// Todas las rutas de dispositivos requieren un JWT válido.
router.use(verificarToken);


// Registrar un dispositivo.
router.post('/', async (req, res) => {
  try {
    const {
      serial,
      nombre,
      ownerType,
      ownerId
    } = req.body;

    if (
      !serial ||
      !nombre ||
      !ownerType ||
      ownerId === undefined
    ) {
      return res.status(400).json({
        error: 'serial, nombre, ownerType y ownerId son obligatorios'
      });
    }

    if (
      ownerType !== 'user' &&
      ownerType !== 'project'
    ) {
      return res.status(400).json({
        error: 'ownerType debe ser user o project'
      });
    }

    // Si el dispositivo pertenece directamente a un usuario, solo ese usuario puede registrarlo a su nombre.
    if (
      ownerType === 'user' &&
      String(ownerId) !== String(req.usuario.id)
    ) {
      return res.status(403).json({
        error: 'No tiene permiso para registrar este dispositivo'
      });
    }

    const device = await crearDevice({
      serial,
      nombre,
      ownerType,
      ownerId
    });

    return res.status(201).json(device);

  } catch (error) {
    console.error('Error al registrar dispositivo:', error);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});


// Consultar un dispositivo por id.
router.get('/:id', async (req, res) => {
  try {
    const device = await obtenerDevicePorId(req.params.id);

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    // Autorización por recurso para dispositivos pertenecientes directamente a un usuario.
    if (
      device.ownerType === 'user' &&
      String(device.ownerId) !== String(req.usuario.id)
    ) {
      return res.status(403).json({
        error: 'No tiene permiso sobre este dispositivo'
      });
    }

    return res.status(200).json(device);

  } catch (error) {
    console.error('Error al consultar dispositivo:', error);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});


module.exports = router;