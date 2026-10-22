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
  try {
    const { proyectoId } = req.query;

    let sql = `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE p.ownerId = ?
    `;

    const params = [req.usuario.id];

    if (proyectoId !== undefined) {
      sql += ' AND b.proyectoId = ?';
      params.push(proyectoId);
    }

    sql += ' ORDER BY b.id';

    const [bombas] = await pool.query(sql, params);

    res.json(bombas);
  } catch (err) {
    console.error('Error listando bombas:', err);
    res.status(500).json({
      error: 'Error interno al listar bombas'
    });
  }
});

// GET /bombas/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Primero verificamos si la bomba existe y quién es su propietario.
    const [bombas] = await pool.query(`
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
    `, [id]);

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba existe, pero pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para acceder a esta bomba'
      });
    }

    // La bomba existe y pertenece al usuario autenticado.
    res.json(bomba);

  } catch (err) {
    console.error('Error obteniendo bomba:', err);
    res.status(500).json({
      error: 'Error interno al obtener bomba'
    });
  }
});

// POST /bombas
// body: { serie, proyectoId, ubicacion, productoId, volumenObjetivoMl, caudalMlH }
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      serie,
      proyectoId,
      ubicacion,
      productoId,
      volumenObjetivoMl,
      caudalMlH
    } = req.body;

    // Validaciones básicas.
    if (!serie || proyectoId === undefined) {
      return res.status(400).json({
        error: 'serie y proyectoId son requeridos'
      });
    }

    // Verificar que el proyecto pertenece al usuario autenticado.
    const [proyectos] = await connection.query(
      `
      SELECT id
      FROM Proyectos
      WHERE id = ?
        AND ownerId = ?
      `,
      [proyectoId, req.usuario.id]
    );

    if (proyectos.length === 0) {
      return res.status(403).json({
        error: 'No tiene permiso para crear una bomba en este proyecto'
      });
    }

    // La serie debe ser única.
    const [existentes] = await connection.query(
      `
      SELECT id
      FROM Bombas
      WHERE serie = ?
      `,
      [serie]
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        error: 'Ya existe una bomba con esa serie'
      });
    }

    await connection.beginTransaction();

    // Crear la bomba.
    const [resultado] = await connection.query(
      `
      INSERT INTO Bombas
        (serie, proyectoId, ubicacion, productoId,
         volumenObjetivoMl, caudalMlH)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        serie,
        proyectoId,
        ubicacion ?? null,
        productoId ?? null,
        volumenObjetivoMl ?? 0,
        caudalMlH ?? 0
      ]
    );

    const bombaId = resultado.insertId;

    // Registrar el evento de creación.
    await connection.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES (?, ?, 'crear', ?)
      `,
      [
        bombaId,
        req.usuario.id,
        JSON.stringify({
          serie,
          proyectoId,
          ubicacion: ubicacion ?? null,
          productoId: productoId ?? null,
          volumenObjetivoMl: volumenObjetivoMl ?? 0,
          caudalMlH: caudalMlH ?? 0
        })
      ]
    );

    await connection.commit();

    // Obtener la bomba recién creada junto con el producto.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [bombaId]
    );

    res.status(201).json(bombas[0]);

  } catch (err) {
    await connection.rollback();

    // Por si existe una condición de carrera con la serie única.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Ya existe una bomba con esa serie'
      });
    }

    console.error('Error creando bomba:', err);

    res.status(500).json({
      error: 'Error interno al crear bomba'
    });

  } finally {
    connection.release();
  }
});

// PUT /bombas/:id
// body: { ubicacion?, productoId?, volumenObjetivoMl?, caudalMlH? }
// PUT /bombas/:id
// body: { ubicacion?, productoId?, volumenObjetivoMl?, caudalMlH? }
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    ubicacion,
    productoId,
    volumenObjetivoMl,
    caudalMlH
  } = req.body;

  try {
    // ────────────────────────────────────────────────
    // 1. Buscar la bomba y verificar que pertenece
    //    a un proyecto del usuario autenticado.
    // ────────────────────────────────────────────────
    const [bombas] = await pool.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      WHERE b.id = ?
        AND p.ownerId = ?
      `,
      [id, req.usuario.id]
    );

    if (bombas.length === 0) {
      // Diferenciamos entre "no existe" y "existe pero pertenece
      // a otro usuario", tal como hicimos en GET /bombas/:id.
      const [existente] = await pool.query(
        `SELECT id FROM Bombas WHERE id = ?`,
        [id]
      );

      if (existente.length === 0) {
        return res.status(404).json({
          error: 'Bomba no encontrada'
        });
      }

      return res.status(403).json({
        error: 'No tiene permiso para editar esta bomba'
      });
    }

    const bomba = bombas[0];

    // ────────────────────────────────────────────────
    // 2. Regla de negocio:
    //    no se puede modificar una infusión que está
    //    en progreso o pausada.
    // ────────────────────────────────────────────────
    if (bomba.estado === 'infundiendo' || bomba.estado === 'pausada') {
      return res.status(409).json({
        error: 'No se puede editar una bomba mientras la infusión no haya terminado',
        estado: bomba.estado
      });
    }

    // ────────────────────────────────────────────────
    // 3. Verificar que se haya enviado al menos un
    //    campo modificable.
    // ────────────────────────────────────────────────
    const campos = [];

    if (ubicacion !== undefined) {
      campos.push(['ubicacion', ubicacion]);
    }

    if (productoId !== undefined) {
      campos.push(['productoId', productoId]);
    }

    if (volumenObjetivoMl !== undefined) {
      campos.push(['volumenObjetivoMl', volumenObjetivoMl]);
    }

    if (caudalMlH !== undefined) {
      campos.push(['caudalMlH', caudalMlH]);
    }

    if (campos.length === 0) {
      return res.status(400).json({
        error: 'No se proporcionaron campos para modificar'
      });
    }

    // ────────────────────────────────────────────────
    // 4. Si se está cambiando el producto, verificar
    //    que exista.
    // ────────────────────────────────────────────────
    if (productoId !== undefined && productoId !== null) {
      const [productos] = await pool.query(
        `SELECT id FROM Productos WHERE id = ?`,
        [productoId]
      );

      if (productos.length === 0) {
        return res.status(400).json({
          error: 'El producto indicado no existe'
        });
      }
    }

    // ────────────────────────────────────────────────
    // 5. Validaciones básicas de valores numéricos.
    // ────────────────────────────────────────────────
    if (
      volumenObjetivoMl !== undefined &&
      volumenObjetivoMl !== null &&
      Number(volumenObjetivoMl) < 0
    ) {
      return res.status(400).json({
        error: 'El volumen objetivo no puede ser negativo'
      });
    }

    if (
      caudalMlH !== undefined &&
      caudalMlH !== null &&
      Number(caudalMlH) < 0
    ) {
      return res.status(400).json({
        error: 'El caudal no puede ser negativo'
      });
    }

    // ────────────────────────────────────────────────
    // 6. Construir dinámicamente el UPDATE.
    // ────────────────────────────────────────────────
    const setClauses = [];
    const values = [];

    for (const [campo, valor] of campos) {
      setClauses.push(`${campo} = ?`);
      values.push(valor);
    }

    values.push(id);

    await pool.query(
      `
      UPDATE Bombas
      SET ${setClauses.join(', ')}
      WHERE id = ?
      `,
      values
    );

    // ────────────────────────────────────────────────
    // 7. Registrar el evento de edición.
    // ────────────────────────────────────────────────
    const detalle = JSON.stringify({
      cambios: Object.fromEntries(campos),
      estadoAnterior: bomba.estado
    });

    await pool.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES
        (?, ?, 'editar', ?)
      `,
      [id, req.usuario.id, detalle]
    );

    // ────────────────────────────────────────────────
    // 8. Obtener la bomba actualizada.
    // ────────────────────────────────────────────────
    const [actualizadas] = await pool.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    return res.json(actualizadas[0]);

  } catch (err) {
    console.error('Error editando bomba:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// DELETE /bombas/:id
router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    // Buscar la bomba y verificar quién es su propietario.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.estado,
        p.ownerId
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      WHERE b.id = ?
      `,
      [id]
    );

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para eliminar esta bomba'
      });
    }

    // No permitimos eliminar una bomba mientras está infundiendo.
    if (bomba.estado === 'infundiendo') {
      return res.status(409).json({
        error: 'No se puede eliminar una bomba mientras está infundiendo'
      });
    }

    // Verificar si la bomba tiene historial de eventos.
    const [eventos] = await connection.query(
      `
      SELECT COUNT(*) AS cantidad
      FROM EventosControl
      WHERE bombaId = ?
      `,
      [id]
    );

    const cantidadEventos = Number(eventos[0].cantidad);

    // Si existe historial, no lo destruimos.
    if (cantidadEventos > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar la bomba porque tiene historial de eventos'
      });
    }

    // No hay historial, por lo que podemos eliminarla físicamente.
    const [resultado] = await connection.query(
      `
      DELETE FROM Bombas
      WHERE id = ?
      `,
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    res.json({
      message: 'Bomba eliminada correctamente',
      bomba: {
        id: bomba.id,
        serie: bomba.serie,
        proyectoId: bomba.proyectoId
      }
    });

  } catch (err) {
    console.error('Error eliminando bomba:', err);

    res.status(500).json({
      error: 'Error interno al eliminar bomba'
    });

  } finally {
    connection.release();
  }
});


// ─────────────── CONTROL DE LA BOMBA ───────────────

// POST /bombas/:id/iniciar    body: { caudalMlH?, volumenObjetivoMl? }
// POST /bombas/:id/iniciar    body: { caudalMlH?, volumenObjetivoMl? }
router.post('/:id/iniciar', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { caudalMlH, volumenObjetivoMl } = req.body;

    // Buscar la bomba junto con el propietario del proyecto.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.productoId,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      WHERE b.id = ?
      `,
      [id]
    );

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba existe, pero pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para controlar esta bomba'
      });
    }

    // No se puede iniciar una bomba que ya está infundiendo.
    if (bomba.estado === 'infundiendo') {
      return res.status(409).json({
        error: 'La bomba ya está infundiendo'
      });
    }

    // La bomba debe tener un producto asignado.
    if (bomba.productoId === null) {
      return res.status(400).json({
        error: 'La bomba no tiene un producto asignado'
      });
    }

    // Determinar los valores que realmente se utilizarán.
    const caudalUsado =
      caudalMlH !== undefined
        ? Number(caudalMlH)
        : Number(bomba.caudalMlH);

    const volumenUsado =
      volumenObjetivoMl !== undefined
        ? Number(volumenObjetivoMl)
        : Number(bomba.volumenObjetivoMl);

    // Validar caudal.
    if (!Number.isFinite(caudalUsado) || caudalUsado <= 0) {
      return res.status(400).json({
        error: 'El caudalMlH debe ser mayor que cero'
      });
    }

    // Validar volumen objetivo.
    if (!Number.isFinite(volumenUsado) || volumenUsado <= 0) {
      return res.status(400).json({
        error: 'El volumenObjetivoMl debe ser mayor que cero'
      });
    }

    await connection.beginTransaction();

    // Iniciar la infusión.
    await connection.query(
      `
      UPDATE Bombas
      SET
        estado = 'infundiendo',
        caudalMlH = ?,
        volumenObjetivoMl = ?,
        volumenEntregadoMl = 0,
        iniciadaEn = NOW(),
        programadaPara = NULL
      WHERE id = ?
      `,
      [
        caudalUsado,
        volumenUsado,
        id
      ]
    );

    // Registrar el evento.
    await connection.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES (?, ?, 'iniciar', ?)
      `,
      [
        id,
        req.usuario.id,
        JSON.stringify({
          caudalMlH: caudalUsado,
          volumenObjetivoMl: volumenUsado
        })
      ]
    );

    await connection.commit();

    // Devolver la bomba actualizada.
    const [resultado] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    res.json(resultado[0]);

  } catch (err) {
    await connection.rollback();

    console.error('Error iniciando bomba:', err);

    res.status(500).json({
      error: 'Error interno al iniciar bomba'
    });

  } finally {
    connection.release();
  }
});

// POST /bombas/:id/programar   body: { programadaPara, caudalMlH?, volumenObjetivoMl? }
// POST /bombas/:id/programar   body: { programadaPara, caudalMlH?, volumenObjetivoMl? }
router.post('/:id/programar', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const {
      programadaPara,
      caudalMlH,
      volumenObjetivoMl
    } = req.body;

    // Buscar la bomba junto con el propietario del proyecto.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.productoId,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      WHERE b.id = ?
      `,
      [id]
    );

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba existe, pero pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para controlar esta bomba'
      });
    }

    // No tiene sentido programar una bomba que ya está infundiendo.
    if (bomba.estado === 'infundiendo') {
      return res.status(409).json({
        error: 'No se puede programar una bomba que está infundiendo'
      });
    }

    // Verificar que se haya proporcionado una fecha.
    if (!programadaPara) {
      return res.status(400).json({
        error: 'programadaPara es requerido'
      });
    }

    // Convertir la fecha recibida a Date.
    const fechaProgramada = new Date(programadaPara);

    // Verificar que la fecha sea válida.
    if (Number.isNaN(fechaProgramada.getTime())) {
      return res.status(400).json({
        error: 'programadaPara debe ser una fecha válida'
      });
    }

    // La fecha debe estar en el futuro.
    if (fechaProgramada.getTime() <= Date.now()) {
      return res.status(400).json({
        error: 'programadaPara debe ser una fecha futura'
      });
    }

    // La bomba debe tener un producto asignado.
    if (bomba.productoId === null) {
      return res.status(400).json({
        error: 'La bomba no tiene un producto asignado'
      });
    }

    // Determinar los valores que se utilizarán.
    const caudalUsado =
      caudalMlH !== undefined
        ? Number(caudalMlH)
        : Number(bomba.caudalMlH);

    const volumenUsado =
      volumenObjetivoMl !== undefined
        ? Number(volumenObjetivoMl)
        : Number(bomba.volumenObjetivoMl);

    // Validar caudal.
    if (!Number.isFinite(caudalUsado) || caudalUsado <= 0) {
      return res.status(400).json({
        error: 'El caudalMlH debe ser mayor que cero'
      });
    }

    // Validar volumen objetivo.
    if (!Number.isFinite(volumenUsado) || volumenUsado <= 0) {
      return res.status(400).json({
        error: 'El volumenObjetivoMl debe ser mayor que cero'
      });
    }

    await connection.beginTransaction();

    // Dejar la bomba programada.
    await connection.query(
      `
      UPDATE Bombas
      SET
        estado = 'programada',
        caudalMlH = ?,
        volumenObjetivoMl = ?,
        programadaPara = ?,
        iniciadaEn = NULL
      WHERE id = ?
      `,
      [
        caudalUsado,
        volumenUsado,
        fechaProgramada,
        id
      ]
    );

    // Registrar el evento.
    await connection.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES (?, ?, 'programar', ?)
      `,
      [
        id,
        req.usuario.id,
        JSON.stringify({
          programadaPara: fechaProgramada.toISOString(),
          caudalMlH: caudalUsado,
          volumenObjetivoMl: volumenUsado
        })
      ]
    );

    await connection.commit();

    // Devolver la bomba actualizada.
    const [resultado] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    res.json(resultado[0]);

  } catch (err) {
    await connection.rollback();

    console.error('Error programando bomba:', err);

    res.status(500).json({
      error: 'Error interno al programar bomba'
    });

  } finally {
    connection.release();
  }
});

// POST /bombas/:id/pausar
// POST /bombas/:id/pausar
router.post('/:id/pausar', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    // Buscar la bomba y verificar quién es su propietario.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para pausar esta bomba'
      });
    }

    // Solo se puede pausar una bomba que está infundiendo.
    if (bomba.estado !== 'infundiendo') {
      return res.status(409).json({
        error: 'La bomba no está infundiendo'
      });
    }

    await connection.beginTransaction();

    // Pausar la bomba.
    // IMPORTANTE: no modificamos volumenEntregadoMl.
    await connection.query(
      `
      UPDATE Bombas
      SET estado = 'pausada'
      WHERE id = ?
      `,
      [id]
    );

    // Registrar el evento de pausa.
    await connection.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES (?, ?, 'pausar', ?)
      `,
      [
        id,
        req.usuario.id,
        JSON.stringify({
          volumenEntregadoMl: bomba.volumenEntregadoMl,
          caudalMlH: bomba.caudalMlH,
          volumenObjetivoMl: bomba.volumenObjetivoMl
        })
      ]
    );

    await connection.commit();

    // Obtener la bomba actualizada.
    const [bombasActualizadas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    res.json(bombasActualizadas[0]);

  } catch (err) {
    await connection.rollback();

    console.error('Error pausando bomba:', err);

    res.status(500).json({
      error: 'Error interno al pausar la bomba'
    });

  } finally {
    connection.release();
  }
});

// POST /bombas/:id/detener
// POST /bombas/:id/detener
router.post('/:id/detener', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    // Buscar la bomba y verificar su propietario.
    const [bombas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        p.ownerId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      JOIN Proyectos p ON p.id = b.proyectoId
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    // La bomba no existe.
    if (bombas.length === 0) {
      return res.status(404).json({
        error: 'Bomba no encontrada'
      });
    }

    const bomba = bombas[0];

    // La bomba pertenece a otro usuario.
    if (bomba.ownerId !== Number(req.usuario.id)) {
      return res.status(403).json({
        error: 'No tiene permiso para detener esta bomba'
      });
    }

    // Una bomba ya detenida no necesita ser detenida nuevamente.
    if (bomba.estado === 'detenida') {
      return res.status(409).json({
        error: 'La bomba ya está detenida'
      });
    }

    await connection.beginTransaction();

    // Detener la bomba y limpiar la configuración de operación.
    // El volumen entregado NO se modifica.
    await connection.query(
      `
      UPDATE Bombas
      SET
        estado = 'detenida',
        caudalMlH = 0,
        volumenObjetivoMl = 0,
        programadaPara = NULL
      WHERE id = ?
      `,
      [id]
    );

    // Registrar el evento antes de finalizar la transacción.
    await connection.query(
      `
      INSERT INTO EventosControl
        (bombaId, usuarioId, accion, detalle)
      VALUES (?, ?, 'detener', ?)
      `,
      [
        id,
        req.usuario.id,
        JSON.stringify({
          estadoAnterior: bomba.estado,
          caudalMlHAnterior: bomba.caudalMlH,
          volumenObjetivoMlAnterior: bomba.volumenObjetivoMl,
          programadaParaAnterior: bomba.programadaPara,
          volumenEntregadoMl: bomba.volumenEntregadoMl
        })
      ]
    );

    await connection.commit();

    // Obtener la bomba actualizada.
    const [bombasActualizadas] = await connection.query(
      `
      SELECT
        b.id,
        b.serie,
        b.proyectoId,
        b.ubicacion,
        b.productoId,
        pr.nombre AS producto,
        b.estado,
        b.caudalMlH,
        b.volumenObjetivoMl,
        b.volumenEntregadoMl,
        b.programadaPara,
        b.iniciadaEn,
        b.actualizadaEn
      FROM Bombas b
      LEFT JOIN Productos pr ON pr.id = b.productoId
      WHERE b.id = ?
      `,
      [id]
    );

    res.json(bombasActualizadas[0]);

  } catch (err) {
    await connection.rollback();

    console.error('Error deteniendo bomba:', err);

    res.status(500).json({
      error: 'Error interno al detener la bomba'
    });

  } finally {
    connection.release();
  }
});

module.exports = router;
