const { test } = require('node:test');
const assert = require('node:assert/strict');
const updater = require('../../core/updater');

test('updater: versions are compared by their numbers', () => {
  assert.equal(updater.isNewer('1.0.1', '1.0.0'), true);
  assert.equal(updater.isNewer('v1.2.0', '1.1.9'), true);
  assert.equal(updater.isNewer('1.0.0', '1.0.0'), false);
  assert.equal(updater.isNewer('0.9.9', '1.0.0'), false);
  assert.equal(updater.isNewer('2.0.0-beta', '1.9.9'), true);
  assert.equal(updater.isNewer('garbage', '1.0.0'), false);
});

test('updater: a manifest must have a version, an https installer and a checksum', () => {
  const ok = { version: '1.1.0', url: 'https://example.com/Lumen-Client-Setup-1.1.0.exe', sha256: 'a'.repeat(64), notes: 'Fixes' };
  const v = updater.validate(ok);
  assert.equal(v.version, '1.1.0');
  assert.equal(v.name, 'Lumen-Client-Setup-1.1.0.exe');
  assert.throws(() => updater.validate({ ...ok, url: 'http://example.com/a.exe' }), /https/);
  assert.throws(() => updater.validate({ ...ok, sha256: 'abc' }), /SHA-256/);
  assert.throws(() => updater.validate({ ...ok, url: 'https://example.com/readme.txt' }), /installer/);
  assert.throws(() => updater.validate({ ...ok, version: 'x' }), /version/);
  assert.throws(() => updater.validate(null), /not valid/);
});

test('updater: without an address there is nothing to check', async () => {
  const r = await updater.check('1.0.0', '');
  assert.equal(r.configured, false);
  assert.equal(r.available, false);
});

test('updater: the installer is kept only when its checksum matches', async () => {
  const http = require('http');
  const crypto = require('crypto');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const body = Buffer.from('pretend installer');
  const server = http.createServer((req, res) => res.end(body));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/Setup.exe`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-upd-'));
  try {
    const good = { url, name: 'Setup.exe', sha256: crypto.createHash('sha256').update(body).digest('hex') };
    const file = await updater.fetchInstaller(good, dir);
    assert.equal(fs.readFileSync(file, 'utf8'), 'pretend installer');
    fs.rmSync(file);
    await assert.rejects(updater.fetchInstaller({ ...good, sha256: 'b'.repeat(64) }, dir), /checksum/);
    assert.deepEqual(fs.readdirSync(dir), [], 'a bad download must leave nothing behind');
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
