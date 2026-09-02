// El bucle que hace avanzar las bombas — ya resuelto.
//
// Cada segundo, toda bomba en estado 'infundiendo' entrega
// caudalMlH / 3600 mililitros. Al alcanzar el objetivo pasa a 'completada'.
//
// Gracias a esto el estado cambia SOLO, con el tiempo: por eso el
// frontend tiene que consultar periódicamente. Ese detalle prepara el
// Taller 3, donde la bomba pasa a reportar por su cuenta.
const pool = require('./db');

function arrancarBucle() {
  setInterval(async () => {
    try {
      await pool.query(`
        UPDATE Bombas
           SET volumenEntregadoMl = LEAST(volumenObjetivoMl,
                                          volumenEntregadoMl + caudalMlH / 3600),
               estado = CASE
                 WHEN volumenEntregadoMl + caudalMlH / 3600 >= volumenObjetivoMl
                 THEN 'completada' ELSE 'infundiendo' END
         WHERE estado = 'infundiendo'
      `);
    } catch (err) {
      console.error('Error en el bucle:', err.message);
    }
  }, 1000);
}

module.exports = { arrancarBucle };
