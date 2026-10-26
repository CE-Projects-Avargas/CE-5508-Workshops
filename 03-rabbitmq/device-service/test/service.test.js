const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorize, validateDevice, validateAlert, createService } = require('../service');
const req = { usuario: { id: '1' }, headers: { authorization: 'Bearer token' } };

test('no permite crear dispositivos para otro usuario', async () => {
  const service = createService({ getConnection() { throw new Error('No debe escribir'); } });
  await assert.rejects(service.register({ serial: 'A', nombre: 'B', ownerType: 'user', ownerId: 2 }, req), { status: 403 });
});
test('valida tipos, longitudes y enteros sin coerción insegura', () => {
  for (const ownerId of [true, null, [], 1.5, -1, '1e0', 2147483648]) {
    assert.throws(() => validateDevice({ serial: 'A', nombre: 'B', ownerType: 'user', ownerId }), { status: 400 });
  }
  assert.throws(() => validateDevice({ serial: {}, nombre: 'B', ownerType: 'user', ownerId: 1 }), { status: 400 });
  assert.throws(() => validateAlert({ level: 'unknown', message: 'x' }), { status: 400 });
});
test('reenvía JWT al backend y rechaza proyecto ajeno o backend caído', async () => {
  const owner = { ownerType: 'project', ownerId: 7 };
  await authorize(owner, req, async (url, options) => {
    assert.ok(url.endsWith('/proyectos/7'));
    assert.equal(options.headers.Authorization, 'Bearer token');
    return { ok: true, json: async () => ({ id: 7, ownerId: 1 }) };
  });
  await assert.rejects(authorize(owner, req, async () => ({ status: 403 })), { status: 403 });
  await assert.rejects(authorize(owner, req, async () => { throw new Error('offline'); }), { status: 503 });
});
test('consultar dispositivo distingue inexistente y ajeno', async () => {
  const service = createService({ execute: async () => [[]] });
  await assert.rejects(service.get('8', req), { status: 404 });
  const other = createService({ execute: async () => [[{ id: 8, ownerType: 'user', ownerId: 2 }]] });
  await assert.rejects(other.get('8', req), { status: 403 });
});
test('dispositivo y evento se confirman juntos; falla de evento revierte dispositivo', async () => {
  const calls = [];
  let failEvent = false;
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    execute: async (sql, values) => {
      if (sql.includes('Devices')) { calls.push('device'); return [{ insertId: 3 }]; }
      calls.push('event');
      const event = JSON.parse(values[1]);
      assert.equal(event.type, 'device.registered');
      assert.equal(event.deviceId, 3);
      assert.equal(event.ownerId, 1);
      assert.ok(event.eventId && event.occurredAt);
      if (failEvent) throw new Error('DB offline');
      return [{}];
    },
    commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release')
  };
  const service = createService({ getConnection: async () => connection });
  const body = { serial: 'A', nombre: 'B', ownerType: 'user', ownerId: 1 };
  await service.register(body, req);
  assert.deepEqual(calls, ['begin', 'device', 'event', 'commit', 'release']);
  calls.length = 0; failEvent = true;
  await assert.rejects(service.register(body, req), /DB offline/);
  assert.deepEqual(calls, ['begin', 'device', 'event', 'rollback', 'release']);
});
test('alerta ajena no escribe eventos y alerta propia incluye nivel y mensaje', async () => {
  const events = [];
  let ownerId = 2;
  const service = createService({ execute: async (sql, values) => {
    if (sql.startsWith('SELECT')) return [[{ id: 9, ownerType: 'user', ownerId }]];
    events.push(JSON.parse(values[1])); return [{}];
  } });
  await assert.rejects(service.alert('9', { level: 'critical', message: 'Falla' }, req), { status: 403 });
  assert.equal(events.length, 0);
  ownerId = 1;
  await service.alert('9', { level: 'critical', message: 'Falla' }, req);
  assert.equal(events[0].type, 'device.alert.triggered');
  assert.deepEqual(events[0].data, { level: 'critical', message: 'Falla' });
});
