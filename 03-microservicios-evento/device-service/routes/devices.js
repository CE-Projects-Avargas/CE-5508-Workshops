const express = require('express');
const db = require('../db');
const { publicarEvento } = require('../events');
const { randomUUID } = require('crypto');

const router = express.Router();

/**
 * Convierte un valor a entero positivo seguro.
 * Devuelve null si el valor no es válido.
 */
function enteroPositivo(valor) {
  const numero = Number(valor);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return null;
  }

  return numero;
}

/**
 * POST /devices
 * Registra un dispositivo asociado al usuario autenticado.
 */
router.post('/', async (req, res) => {
  const { serial, nombre, ownerType, ownerId } = req.body;

  if (
    typeof serial !== 'string' ||
    !serial.trim() ||
    typeof nombre !== 'string' ||
    !nombre.trim()
  ) {
    return res.status(400).json({
      error: 'Los campos serial y nombre son obligatorios'
    });
  }

  if (!['user', 'project'].includes(ownerType)) {
    return res.status(400).json({
      error: 'ownerType debe ser user o project'
    });
  }

  const propietarioId = enteroPositivo(ownerId);

  if (propietarioId === null) {
    return res.status(400).json({
      error: 'ownerId debe ser un entero positivo'
    });
  }

  const usuarioId = enteroPositivo(req.usuario.id);

  if (usuarioId === null) {
    return res.status(401).json({
      error: 'El usuario autenticado no tiene un identificador válido'
    });
  }

  // La autorización de proyectos se implementará en el paso 7.
  if (ownerType === 'project') {
    return res.status(403).json({
      error: 'El registro de dispositivos para proyectos aún no está habilitado'
    });
  }

  // Un usuario solo puede registrar dispositivos a su propio nombre.
  if (propietarioId !== usuarioId) {
    return res.status(403).json({
      error: 'No puedes registrar dispositivos para otro usuario'
    });
  }

  try {
    const [resultado] = await db.execute(
      `INSERT INTO Devices (serial, nombre, ownerType, ownerId)
       VALUES (?, ?, ?, ?)`,
      [serial.trim(), nombre.trim(), 'user', usuarioId]
    );

    const [dispositivos] = await db.execute(
        `SELECT id, serial, nombre, ownerType, ownerId, createdAt, updatedAt
        FROM Devices
        WHERE id = ?`,
        [resultado.insertId]
    );

    const dispositivo = dispositivos[0];

    const evento = {
        eventId: randomUUID(),
        type: 'device.registered',
        occurredAt: new Date().toISOString(),
        deviceId: dispositivo.id,
        ownerType: dispositivo.ownerType,
        ownerId: dispositivo.ownerId,
        data: {
            serial: dispositivo.serial,
            nombre: dispositivo.nombre
        }
    };

    try {
    await publicarEvento('device.registered', evento);
    } catch (error) {
    console.error(
        'El dispositivo se registró, pero no se pudo publicar el evento:',
        error.message
    );

    return res.status(503).json({
        error: 'El dispositivo se registró, pero no se pudo confirmar la publicación del evento',
        deviceId: dispositivo.id
    });
    }

    return res.status(201).json(dispositivo);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Ya existe un dispositivo con ese serial'
      });
    }

    console.error('Error al registrar el dispositivo:', error.message);

    return res.status(500).json({
      error: 'No se pudo registrar el dispositivo'
    });
  }
});

/**
 * GET /devices/:id
 * Consulta un dispositivo del usuario autenticado.
 */
router.get('/:id', async (req, res) => {
  const dispositivoId = enteroPositivo(req.params.id);
  const usuarioId = enteroPositivo(req.usuario.id);

  if (dispositivoId === null) {
    return res.status(400).json({
      error: 'El identificador del dispositivo no es válido'
    });
  }

  if (usuarioId === null) {
    return res.status(401).json({
      error: 'El usuario autenticado no tiene un identificador válido'
    });
  }

  try {
    const [dispositivos] = await db.execute(
      `SELECT id, serial, nombre, ownerType, ownerId, createdAt, updatedAt
       FROM Devices
       WHERE id = ?`,
      [dispositivoId]
    );

    if (dispositivos.length === 0) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const dispositivo = dispositivos[0];

    // Hasta implementar la autorización de proyectos, estos dispositivos
    // no se exponen mediante este endpoint.
    if (dispositivo.ownerType === 'project') {
      return res.status(403).json({
        error: 'La autorización para dispositivos de proyectos aún no está habilitada'
      });
    }

    if (Number(dispositivo.ownerId) !== usuarioId) {
      return res.status(403).json({
        error: 'No tienes permiso para consultar este dispositivo'
      });
    }

    return res.status(200).json(dispositivo);
  } catch (error) {
    console.error('Error al consultar el dispositivo:', error.message);

    return res.status(500).json({
      error: 'No se pudo consultar el dispositivo'
    });
  }
});

router.post('/:id/alerts', async (req, res) => {
  const dispositivoId = enteroPositivo(req.params.id);
  const usuarioId = enteroPositivo(req.usuario.id);
  const { level, message } = req.body;

  if (dispositivoId === null) {
    return res.status(400).json({
      error: 'El identificador del dispositivo no es válido'
    });
  }

  if (usuarioId === null) {
    return res.status(401).json({
      error: 'El usuario autenticado no tiene un identificador válido'
    });
  }

  if (
    typeof level !== 'string' ||
    !level.trim() ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return res.status(400).json({
      error: 'Los campos level y message son obligatorios'
    });
  }

  try {
    const [dispositivos] = await db.execute(
      `SELECT id, serial, nombre, ownerType, ownerId
       FROM Devices
       WHERE id = ?`,
      [dispositivoId]
    );

    if (dispositivos.length === 0) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const dispositivo = dispositivos[0];

    // La autorización de dispositivos de proyectos se implementará
    // en el paso 7.
    if (dispositivo.ownerType === 'project') {
      return res.status(403).json({
        error: 'La autorización para dispositivos de proyectos aún no está habilitada'
      });
    }

    if (Number(dispositivo.ownerId) !== usuarioId) {
      return res.status(403).json({
        error: 'No tienes permiso para reportar alertas en este dispositivo'
      });
    }

    const evento = {
      eventId: randomUUID(),
      type: 'device.alert.triggered',
      occurredAt: new Date().toISOString(),
      deviceId: dispositivo.id,
      ownerType: dispositivo.ownerType,
      ownerId: dispositivo.ownerId,
      userId: usuarioId,
      data: {
        serial: dispositivo.serial,
        nombre: dispositivo.nombre,
        level: level.trim(),
        message: message.trim()
      }
    };

    await publicarEvento('device.alert.triggered', evento);

    return res.status(202).json({
      message: 'Alerta aceptada para procesamiento',
      eventId: evento.eventId
    });
  } catch (error) {
    console.error(
      'Error al procesar la alerta del dispositivo:',
      error.message
    );

    return res.status(503).json({
      error: 'No se pudo publicar la alerta'
    });
  }
});

module.exports = router;
