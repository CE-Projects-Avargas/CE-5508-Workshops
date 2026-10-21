// Rutas de proyectos, llegan aquí únicamente después de superar la validación JWT del middleware.
const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

// Lista únicamente los proyectos del usuario autenticado
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.findAll({
      where: {
        usuarioId: req.usuario.id
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtiene un proyecto específico si pertenece al usuario
router.get('/:id', async (req, res) => {
  try {
    const proyecto = await Proyecto.findByPk(req.params.id);

    if (!proyecto) {
      return res.status(404).json({
        error: 'Proyecto no encontrado'
      });
    }

    if (proyecto.usuarioId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para acceder a este proyecto'
      });
    }

    res.json(proyecto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crea un proyecto asociado al usuario autenticado
router.post('/', async (req, res) => {
  try {
    console.log('Usuario recibido en proyectos:', req.usuario);
    
    const proyecto = await Proyecto.create({
      ...req.body,
      usuarioId: req.usuario.id
    });

    res.status(201).json(proyecto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;