// The Node skin service, run for real on a local port (the shared checks are in skin-suite.js).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createService } = require('../../server/skin-service');
const { runSuite } = require('./skin-suite');

runSuite('node service', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-skinsvc-'));
  const server = createService({ data: dir, writesPerMin: 1000 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
});

test('node service: too many writes from one address are slowed down; health works', async () => {
  const strict = createService({ data: fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-skinsvc2-')), writesPerMin: 2 });
  await new Promise((r) => strict.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${strict.address().port}/v1/profile/Dave_4`;
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await fetch(url, { method: 'PUT', body: '{}' })).status);
  assert.equal(statuses.at(-1), 429);
  assert.equal((await (await fetch(`http://127.0.0.1:${strict.address().port}/v1/health`)).json()).ok, true);
  strict.close();
});
