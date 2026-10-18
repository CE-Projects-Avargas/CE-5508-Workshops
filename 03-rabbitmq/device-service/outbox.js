function createDispatcher(pool, publicar) {
  let running = false;
  return async function dispatch() {
    if (running) return;
    running = true;
    try {
      const [rows] = await pool.query('SELECT eventId, payload FROM Outbox WHERE publishedAt IS NULL ORDER BY createdAt LIMIT 100');
      for (const row of rows) {
        const event = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        await publicar(event);
        // Un fallo aquí puede reenviar el evento: el consumidor deduplica por eventId.
        await pool.execute('UPDATE Outbox SET publishedAt = NOW(3) WHERE eventId = ?', [row.eventId]);
      }
    } catch (err) { console.error('Outbox pendiente, se reintentará:', err.message); }
    finally { running = false; }
  };
}
module.exports = { createDispatcher };
