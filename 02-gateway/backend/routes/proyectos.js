const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

function idUsuario(req) {
  return Number(req.usuario.id);
}

function esDuenio(proyecto, usuarioId) {
  return Number(proyecto.ownerId) === usuarioId;
}

// GET /proyectos - lista todos los proyectos
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.findAll({
      where: { ownerId: idUsuario(req) },
      order: [['createdAt', 'DESC']]
    });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /proyectos/:id - obtiene un proyecto si pertenece al usuario
router.get('/:id', async (req, res) => {
  try {
    const proyecto = await Proyecto.findByPk(req.params.id);
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    if (!esDuenio(proyecto, idUsuario(req))) {
      return res.status(403).json({ error: 'No tiene permiso para acceder a este proyecto' });
    }

    return res.json(proyecto);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /proyectos - crea un proyecto nuevo
router.post('/', async (req, res) => {
  try {
    const usuarioId = idUsuario(req);
    const ownerIdSolicitado = req.body.ownerId == null ? usuarioId : Number(req.body.ownerId);

    if (ownerIdSolicitado !== usuarioId) {
      return res.status(403).json({ error: 'No puede crear proyectos para otro usuario' });
    }

    const proyecto = await Proyecto.create({ ...req.body, ownerId: usuarioId });
    res.status(201).json(proyecto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
