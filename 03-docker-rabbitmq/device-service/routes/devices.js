const express = require('express');

const router = express.Router();

const verificarToken = require('../middleware/verificarToken');

const crypto = require('crypto');

const {
  crearDevice,
  obtenerDevicePorId
} = require('../models/Device');

const {
  publicarEvento
} = require('../rabbitmq');

const BACKEND_URL =
  process.env.BACKEND_URL ||
  'http://backend:4000';


// Consulta al backend para comprobar que el usuario autenticado tenga acceso al proyecto indicado.
async function verificarAccesoProyecto(projectId, authorization) {

  const response = await fetch(
    `${BACKEND_URL}/proyectos/${projectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: authorization
      }
    }
  );

  if (response.status === 200) {
    return {
      autorizado: true
    };
  }

  if (response.status === 401) {
    return {
      autorizado: false,
      status: 401,
      error: 'Token inválido o expirado'
    };
  }

  if (response.status === 403) {
    return {
      autorizado: false,
      status: 403,
      error: 'No tiene permiso sobre el proyecto'
    };
  }

  if (response.status === 404) {
    return {
      autorizado: false,
      status: 404,
      error: 'Proyecto no encontrado'
    };
  }

  throw new Error(
    `Backend respondió con estado ${response.status}`
  );
}

// Valida si el usuario autenticado tiene permiso sobre el propietario del dispositivo.
async function verificarPermisoPropietario(
  ownerType,
  ownerId,
  req
) {

  if (ownerType === 'user') {

    if (
      String(ownerId) !== String(req.usuario.id)
    ) {
      return {
        autorizado: false,
        status: 403,
        error: 'No tiene permiso sobre este dispositivo'
      };
    }

    return {
      autorizado: true
    };
  }

  if (ownerType === 'project') {

    return verificarAccesoProyecto(
      ownerId,
      req.headers.authorization
    );
  }

  return {
    autorizado: false,
    status: 400,
    error: 'Tipo de propietario inválido'
  };
}

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
        error:
          'serial, nombre, ownerType y ownerId son obligatorios'
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


    const permiso =
      await verificarPermisoPropietario(
        ownerType,
        ownerId,
        req
      );

    if (!permiso.autorizado) {
      return res.status(permiso.status).json({
        error: permiso.error
      });
    }


    const device = await crearDevice({
      serial,
      nombre,
      ownerType,
      ownerId
    });


    const evento = {
      eventId: crypto.randomUUID(),
      type: 'device.registered',
      occurredAt: new Date().toISOString(),
      deviceId: device.id,
      ownerType: device.ownerType,
      ownerId: device.ownerId
    };


    await publicarEvento(
      'device.registered',
      evento
    );


    return res.status(201).json(device);

  } catch (error) {

    console.error(
      'Error al registrar dispositivo:',
      error
    );

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});


// Consultar un dispositivo por id.
router.get('/:id', async (req, res) => {
  try {

    const device =
      await obtenerDevicePorId(req.params.id);

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }


    const permiso =
      await verificarPermisoPropietario(
        device.ownerType,
        device.ownerId,
        req
      );

    if (!permiso.autorizado) {
      return res.status(permiso.status).json({
        error: permiso.error
      });
    }


    return res.status(200).json(device);

  } catch (error) {

    console.error(
      'Error al consultar dispositivo:',
      error
    );

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});


// Publicar una alerta para un dispositivo.
router.post('/:id/alerts', async (req, res) => {
  try {

    const device =
      await obtenerDevicePorId(req.params.id);

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }


    const permiso =
      await verificarPermisoPropietario(
        device.ownerType,
        device.ownerId,
        req
      );

    if (!permiso.autorizado) {
      return res.status(permiso.status).json({
        error: permiso.error
      });
    }


    const {
      level,
      message
    } = req.body;

    if (!level || !message) {
      return res.status(400).json({
        error: 'level y message son obligatorios'
      });
    }


    const evento = {
      eventId: crypto.randomUUID(),
      type: 'device.alert.triggered',
      occurredAt: new Date().toISOString(),
      deviceId: device.id,
      ownerType: device.ownerType,
      ownerId: device.ownerId,
      level,
      message
    };


    await publicarEvento(
      'device.alert.triggered',
      evento
    );


    return res.status(202).json({
      mensaje: 'Alerta publicada correctamente',
      eventId: evento.eventId
    });

  } catch (error) {

    console.error(
      'Error al publicar alerta:',
      error
    );

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});


module.exports = router;