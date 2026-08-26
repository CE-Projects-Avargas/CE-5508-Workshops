const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

// Este archivo ya funciona completo — úsalo como referencia del patrón
// que vas a repetir en auth.js para /auth/register y /auth/login.

// GET /proyectos - lista todos los proyectos
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.findAll({ order: [['createdAt', 'DESC']] });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /proyectos - crea un proyecto nuevo
router.post('/', async (req, res) => {
  try {
    const proyecto = await Proyecto.create(req.body);
    res.status(201).json(proyecto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
