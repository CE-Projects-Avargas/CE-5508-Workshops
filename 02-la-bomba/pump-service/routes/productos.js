// Catálogo de productos — YA RESUELTO.
//
// Es un catálogo de solo lectura, igual para todos los usuarios:
// no hay nada que autorizar aquí. Se los damos hecho para que el
// esfuerzo del taller quede en el servicio de bombas.
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT id, nombre, concentracion, unidad FROM Productos ORDER BY nombre'
    );
    res.json(filas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
