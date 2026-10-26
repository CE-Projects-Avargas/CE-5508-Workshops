const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDispatcher } = require('../outbox');
const event = { eventId: 'abc', type: 'device.registered', deviceId: 1 };

test('usa el publicador entregado por Persona 2 y marca después de confirmar', async () => {
  const calls = [];
  const pool = {
    query: async () => [[{ eventId: event.eventId, payload: JSON.stringify(event) }]],
    execute: async (sql, values) => { assert.deepEqual(values, ['abc']); calls.push('mark'); }
  };
  await createDispatcher(pool, async received => { assert.deepEqual(received, event); calls.push('publish'); })();
  assert.deepEqual(calls, ['publish', 'mark']);
});
test('fallo del publicador conserva el evento pendiente y permite reintentar', async () => {
  let fails = true, marked = false;
  const pool = {
    query: async () => [[{ eventId: event.eventId, payload: event }]],
    execute: async () => { marked = true; }
  };
  const dispatch = createDispatcher(pool, async () => { if (fails) throw new Error('Conexión no disponible'); });
  await dispatch();
  assert.equal(marked, false);
  fails = false;
  await dispatch();
  assert.equal(marked, true);
});
