const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../auth');

router.use(verificarToken);   // todas las rutas exigen token

// ════════════════════════════════════════════════════════════════
//  RETO DEL TALLER 2 — Autorización basada en propiedad de datos
//
//  El token ya dice QUIÉN es el usuario: está en req.usuario.id
//  Falta decidir QUÉ puede tocar.
//
//  Regla: un usuario solo ve y controla las bombas que pertenecen
//  a proyectos de los que es dueño (Proyectos.ownerId).
//
//  Antes de escribir código, decidan CÓMO lo van a resolver:
//
//    Opción A — consultar la BD directamente
//               JOIN Bombas -> Proyectos y comparar ownerId.
//               Rápido, pero este servicio pasa a depender del
//               esquema de Proyectos, que es del backend.
//
//    Opción B — preguntarle al backend
//               GET /proyectos/:id con el token del usuario.
//               Cada servicio es dueño de sus datos, pero se
//               agrega un salto de red y una dependencia en runtime.
//
//  Las dos son defendibles. Tienen que elegir una, implementarla,
//  y poder explicar qué perdieron al elegirla.
// ════════════════════════════════════════════════════════════════

// GET /bombas — solo las bombas de los proyectos del usuario
router.get('/', async (req, res) => {
  // TODO 1: obtener las bombas filtrando por propiedad.
  //   El id del usuario está en req.usuario.id
  //   NUNCA tomar el dueño de un query param: lo puede falsificar el cliente.
  res.status(501).json({ error: 'TODO: implementar GET /bombas' });
});

// GET /bombas/:id — estado de una bomba
router.get('/:id', async (req, res) => {
  // TODO 2: devolver la bomba solo si pertenece al usuario.
  //   Si existe pero es de otro: 403, no 404.
  res.status(501).json({ error: 'TODO: implementar GET /bombas/:id' });
});

// POST /bombas/:id/iniciar   body: { caudalMlH, volumenObjetivoMl }
router.post('/:id/iniciar', async (req, res) => {
  // TODO 3: verificar propiedad, luego iniciar la infusión.
  //   - estado = 'infundiendo', guardar caudal y objetivo
  //   - volumenEntregadoMl vuelve a 0, iniciadaEn = ahora
  //   - registrar el evento en EventosControl con req.usuario.id
  res.status(501).json({ error: 'TODO: implementar iniciar' });
});

// POST /bombas/:id/pausar
router.post('/:id/pausar', async (req, res) => {
  // TODO 4: pausar CONSERVANDO el volumen ya entregado.
  //   Registrar el evento.
  res.status(501).json({ error: 'TODO: implementar pausar' });
});

// POST /bombas/:id/detener
router.post('/:id/detener', async (req, res) => {
  // TODO 5: detener y limpiar caudal y objetivo.
  //   Registrar el evento.
  res.status(501).json({ error: 'TODO: implementar detener' });
});

module.exports = router;
