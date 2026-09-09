// El "motor" de las bombas — ya resuelto. No hace falta tocarlo.
//
// Hace dos cosas cada segundo:
//   1. Dispara las bombas cuya hora programada ya llegó.
//   2. Avanza el volumen entregado de las que están infundiendo.
//
// Gracias a esto el estado cambia SOLO, con el tiempo: por eso el
// frontend tiene que consultar periódicamente. Ese detalle prepara el
// Taller 3, donde la bomba pasa a reportar por su cuenta.
const pool = require('./db');

async function dispararProgramadas() {
  // Una bomba 'programada' cuya hora ya pasó arranca sola.
  await pool.query(`
    UPDATE Bombas
       SET estado = 'infundiendo',
           iniciadaEn = NOW(),
           volumenEntregadoMl = 0,
           programadaPara = NULL
     WHERE estado = 'programada'
       AND programadaPara IS NOT NULL
       AND programadaPara <= NOW()
  `);
}

async function avanzarInfusiones() {
  // Cada segundo se entrega caudalMlH / 3600 mililitros.
  await pool.query(`
    UPDATE Bombas
       SET volumenEntregadoMl = LEAST(volumenObjetivoMl,
                                      volumenEntregadoMl + caudalMlH / 3600),
           estado = CASE
             WHEN volumenEntregadoMl + caudalMlH / 3600 >= volumenObjetivoMl
             THEN 'completada' ELSE 'infundiendo' END
     WHERE estado = 'infundiendo'
       AND volumenObjetivoMl > 0
  `);
}

function arrancarBucle() {
  setInterval(async () => {
    try {
      await dispararProgramadas();
      await avanzarInfusiones();
    } catch (err) {
      console.error('Error en el bucle:', err.message);
    }
  }, 1000);
}

module.exports = { arrancarBucle };
