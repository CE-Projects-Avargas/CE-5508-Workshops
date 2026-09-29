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
//  Regla: un usuario solo ve, edita y controla las bombas que
//  pertenecen a proyectos de los que es dueño (Proyectos.ownerId).
//
//  Antes de escribir código, decidan CÓMO lo van a averiguar:
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
//  Las dos son defendibles. Elijan una, impleméntenla, y prepárense
//  para explicar qué perdieron al elegirla.
//
//  SUGERENCIA: escriban una sola función de autorización y úsenla
//  en las nueve rutas. Si la copian y pegan nueve veces, la décima
//  ruta que agreguen se va a olvidar de llamarla.
// ════════════════════════════════════════════════════════════════


// ─────────────── GESTIÓN DE BOMBAS (CRUD) ───────────────

// GET /bombas            todas las bombas del usuario
// GET /bombas?proyectoId=1   filtradas por proyecto
router.get('/', async (req, res) => {
  // TODO 1: listar las bombas de proyectos del usuario.
  //   Incluyan el nombre del producto (JOIN Productos) para que
  //   el frontend no tenga que pedirlo aparte.
  //   NUNCA tomen el dueño de un query param: lo falsifica el cliente.
  res.status(501).json({ error: 'TODO: listar bombas' });
});

// GET /bombas/:id
router.get('/:id', async (req, res) => {
  // TODO 2: devolver la bomba solo si es del usuario.
  //   Si existe pero es de otro: 403, no 404.
  res.status(501).json({ error: 'TODO: obtener bomba' });
});

// POST /bombas
// body: { serie, proyectoId, ubicacion, productoId, volumenObjetivoMl, caudalMlH }
router.post('/', async (req, res) => {
  // TODO 3: crear una bomba.
  //   - Verificar que el proyectoId sea de un proyecto del usuario.
  //     (si no, cualquiera podría meter bombas en proyectos ajenos)
  //   - La serie es única: devolver 409 si ya existe.
  //   - Registrar el evento 'crear' en EventosControl.
  res.status(501).json({ error: 'TODO: crear bomba' });
});

// PUT /bombas/:id
// body: { ubicacion?, productoId?, volumenObjetivoMl?, caudalMlH? }
router.put('/:id', async (req, res) => {
  // TODO 4: editar la configuración de la bomba.
  //   - Verificar propiedad.
  //   - Decidan: ¿se puede editar una bomba que está infundiendo?
  //     Piénsenlo antes de codificar. Es una regla de negocio, no un detalle.
  //   - Registrar el evento 'editar'.
  res.status(501).json({ error: 'TODO: editar bomba' });
});

// DELETE /bombas/:id
router.delete('/:id', async (req, res) => {
  // TODO 5: eliminar la bomba.
  //   - Verificar propiedad.
  //   - ¿Qué pasa con los EventosControl que la referencian?
  //     Borrado en cascada, borrado lógico, o rechazar si tiene historial.
  //     En un sistema clínico el historial no se borra: decidan y justifiquen.
  res.status(501).json({ error: 'TODO: eliminar bomba' });
});


// ─────────────── CONTROL DE LA BOMBA ───────────────

// POST /bombas/:id/iniciar    body: { caudalMlH?, volumenObjetivoMl? }
router.post('/:id/iniciar', async (req, res) => {
  // TODO 6: iniciar la infusión ahora.
  //   - Verificar propiedad.
  //   - La bomba debe tener producto y volumen objetivo asignados:
  //     si no los tiene, 400 con un mensaje claro.
  //   - estado = 'infundiendo', volumenEntregadoMl = 0, iniciadaEn = ahora.
  //   - Registrar el evento 'iniciar' con el caudal y volumen usados.
  res.status(501).json({ error: 'TODO: iniciar' });
});

// POST /bombas/:id/programar   body: { programadaPara, caudalMlH?, volumenObjetivoMl? }
router.post('/:id/programar', async (req, res) => {
  // TODO 7: dejar la bomba lista para arrancar sola a una hora dada.
  //   - Verificar propiedad.
  //   - programadaPara debe ser una fecha FUTURA: si no, 400.
  //   - estado = 'programada'. El bucle la dispara cuando llegue la hora.
  //   - Registrar el evento 'programar'.
  res.status(501).json({ error: 'TODO: programar' });
});

// POST /bombas/:id/pausar
router.post('/:id/pausar', async (req, res) => {
  // TODO 8: pausar CONSERVANDO el volumen ya entregado.
  //   Solo tiene sentido si está infundiendo: si no, 409.
  //   Registrar el evento.
  res.status(501).json({ error: 'TODO: pausar' });
});

// POST /bombas/:id/detener
router.post('/:id/detener', async (req, res) => {
  // TODO 9: detener y limpiar caudal, objetivo y programación.
  //   Registrar el evento.
  res.status(501).json({ error: 'TODO: detener' });
});

module.exports = router;
