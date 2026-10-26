// The skin service, run for real on a local port: claiming a name, keeping others out, validating pictures.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('../../core/png');
const { createService } = require('../../server/skin-service');

let server;
let base;
let dir;
const TOKEN = 'a'.repeat(32);
const solid = (w, h, c) => png.encode(Buffer.from(Array.from({ length: w * h }, () => c).flat()), w, h);
const b64 = (b) => b.toString('base64');
const call = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = r.headers.get('content-type') || '';
  return { status: r.status, body: type.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
};

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-skinsvc-'));
  server = createService({ data: dir, writesPerMin: 1000 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('a new name is claimed with a token, then its picture can be fetched', async () => {
  const skin = solid(64, 64, [10, 200, 30, 255]);
  const put = await call('PUT', '/v1/profile/Alice_1', { token: TOKEN, slim: true, skin: b64(skin) });
  assert.equal(put.status, 200);
  assert.deepEqual({ name: put.body.name, slim: put.body.slim, cape: put.body.cape }, { name: 'Alice_1', slim: true, cape: null });
  const got = await call('GET', '/v1/profile/alice_1'); // names are not case sensitive
  assert.equal(got.status, 200);
  assert.equal(got.body.skin, '/v1/skin/Alice_1');
  const pic = await call('GET', '/v1/skin/alice_1');
  assert.equal(pic.status, 200);
  assert.deepEqual([...png.decode(pic.body).rgba.subarray(0, 4)], [10, 200, 30, 255]);
});

test('only the launcher that claimed a name can change or delete it', async () => {
  const skin = b64(solid(64, 64, [1, 2, 3, 255]));
  assert.equal((await call('PUT', '/v1/profile/Alice_1', { token: 'b'.repeat(32), skin })).status, 403);
  assert.equal((await call('PUT', '/v1/profile/Alice_1', { skin })).status, 401);
  assert.equal((await call('DELETE', '/v1/profile/Alice_1', { token: 'b'.repeat(32) })).status, 403);
  const rev = (await call('GET', '/v1/profile/Alice_1')).body.rev;
  const ok = await call('PUT', '/v1/profile/Alice_1', { token: TOKEN, skin });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.rev, rev + 1);
});

test('pictures of the wrong size, not PNG, or too big are refused', async () => {
  assert.equal((await call('PUT', '/v1/profile/Bob_22', { token: TOKEN, skin: b64(solid(32, 32, [1, 1, 1, 255])) })).status, 400);
  assert.equal((await call('PUT', '/v1/profile/Bob_22', { token: TOKEN, skin: b64(Buffer.from('not a png')) })).status, 400);
  assert.equal((await call('PUT', '/v1/profile/Bob_22', { token: TOKEN, cape: b64(solid(64, 64, [1, 1, 1, 255])) })).status, 400);
  assert.equal((await call('GET', '/v1/profile/Bob_22')).status, 404, 'nothing is created by a refused upload');
  assert.equal((await call('PUT', '/v1/profile/x', { token: TOKEN })).status, 400);
});

test('a cape can be added and removed; lookup answers for many names at once', async () => {
  const cape = b64(solid(64, 32, [200, 0, 0, 255]));
  const put = await call('PUT', '/v1/profile/Alice_1', { token: TOKEN, cape });
  assert.equal(put.body.cape, '/v1/cape/Alice_1');
  await call('PUT', '/v1/profile/Carol_3', { token: 'c'.repeat(32), skin: b64(solid(64, 64, [5, 5, 5, 255])) });
  const many = await call('POST', '/v1/lookup', { names: ['Alice_1', 'Carol_3', 'Nobody', 'bad name!'] });
  assert.deepEqual(Object.keys(many.body.profiles).sort(), ['Alice_1', 'Carol_3']);
  const gone = await call('PUT', '/v1/profile/Alice_1', { token: TOKEN, cape: null });
  assert.equal(gone.body.cape, null);
  assert.equal((await call('GET', '/v1/cape/Alice_1')).status, 404);
});

test('too many writes from one address are slowed down; health works', async () => {
  const strict = createService({ data: fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-skinsvc2-')), writesPerMin: 2 });
  await new Promise((r) => strict.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${strict.address().port}/v1/profile/Dave_4`;
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await fetch(url, { method: 'PUT', body: '{}' })).status);
  strict.close();
  assert.equal(statuses.at(-1), 429);
  assert.equal((await call('GET', '/v1/health')).body.ok, true);
});
