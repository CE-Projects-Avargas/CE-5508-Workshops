const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

// GET /proyectos - lista todos los proyectos
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.findAll({
      where: {
        ownerId: req.usuario.id
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(proyectos);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// GET /proyectos/:id - consulta un proyecto del usuario autenticado
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'El ID del proyecto debe ser un entero positivo'
      });
    }

    const proyecto = await Proyecto.findOne({
      where: {
        id,
        ownerId: req.usuario.id
      }
    });

    if (!proyecto) {
      return res.status(404).json({
        error: 'Proyecto no encontrado'
      });
    }

    return res.json(proyecto);
  } catch (err) {
    console.error('Error al consultar el proyecto:', err.message);

    return res.status(500).json({
      error: 'Error interno al consultar el proyecto'
    });
  }
});

// POST /proyectos - crea un proyecto nuevo
router.post('/', async (req, res) => {
  try {
    const proyecto = await Proyecto.create({
      ...req.body,
      ownerId: req.usuario.id
    });

    res.status(201).json(proyecto);

  } catch (err) {
    res.status(400).json({
      error: err.message
    });
  }
});

module.exports = router;
