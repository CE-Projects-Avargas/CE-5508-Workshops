const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

// Todas estas rutas ya pasaron por verificarJWT: req.usuario es confiable.

// GET /proyectos - lista todos los proyectos
router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.findAll({ order: [['createdAt', 'DESC']] });
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /proyectos - el dueno sale del TOKEN, no del body.
router.post('/', async (req, res) => {
  try {
    const { ownerId, id, ...datos } = req.body || {};
    const proyecto = await Proyecto.create({ ...datos, ownerId: req.usuario.id });
    res.status(201).json(proyecto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /proyectos/:id - solo el dueno puede borrar.
//   401 -> no sabemos quien es (sin token, firma mala, vencido)
//   403 -> sabemos quien es, pero no tiene permiso sobre este proyecto
router.delete('/:id', async (req, res) => {
  try {
    const proyecto = await Proyecto.findByPk(req.params.id);
    if (!proyecto) return res.status(404).json({ error: 'proyecto no encontrado' });
    if (proyecto.ownerId !== req.usuario.id) {
      return res.status(403).json({ error: 'no eres el dueno de este proyecto' });
    }
    await proyecto.destroy();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;