const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sandbox } = require('../helpers');
sandbox();
const store = require('../../core/store');
const instances = require('../../core/instances');
const png = require('../../core/png');
const skins = require('../../core/skins');
const cloud = require('../../core/cloud');
const { createService } = require('../../server/skin-service');

const paint = (w, h, c) => png.encode(Buffer.from(Array.from({ length: w * h }, () => c).flat()), w, h);

test('addresses: only http(s), no trailing slash, empty means off', () => {
  assert.equal(cloud.cleanUrl('https://skins.example.com/'), 'https://skins.example.com');
  assert.equal(cloud.cleanUrl(' http://127.0.0.1:8787 '), 'http://127.0.0.1:8787');
  assert.equal(cloud.cleanUrl(''), '');
  assert.throws(() => cloud.cleanUrl('ftp://x.example'), /https/);
  assert.throws(() => cloud.cleanUrl('skins dot example'), /web address/);
});

test('the secret token is made once and never shown to the page', () => {
  const t1 = cloud.get().token;
  assert.match(t1, /^[0-9a-f]{48}$/);
  assert.equal(cloud.get().token, t1);
  assert.equal('token' in cloud.view(), false);
});

test('your skin and cape reach the service, and the instances are told where it is', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-cloud-'));
  const server = createService({ data: dir, writesPerMin: 1000 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    store.addOfflineAccount('Pilot_7');
    const cfg = store.load();
    store.update({ selectedAccount: cfg.accounts[0].id });
    skins.add(paint(64, 64, [30, 60, 90, 255]), { name: 'Blue', model: 'slim' });
    skins.setCape(paint(64, 32, [200, 10, 10, 255]));

    // an instance with Lumen HUD
    const inst = instances.create({ name: 'Cloudy', version: '26.3', loader: 'fabric' });
    const j = JSON.parse(fs.readFileSync(path.join(instances.dirOf(inst.id), 'instance.json'), 'utf8'));
    j.content['lumen-hud'] = { id: 'lumen-hud', slug: 'lumen-hud', title: 'Lumen HUD', type: 'mod', file: 'x.jar', enabled: true, needs: [] };
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'instance.json'), JSON.stringify(j));

    assert.equal(await cloud.push(), false, 'nothing is uploaded before an address is set');
    cloud.set({ url });
    assert.deepEqual((await cloud.check()).ok, true);
    assert.equal(await cloud.push(), true);

    const profile = await (await fetch(`${url}/v1/profile/Pilot_7`)).json();
    assert.equal(profile.slim, true);
    assert.ok(profile.skin && profile.cape);
    assert.deepEqual([...png.decode(Buffer.from(await (await fetch(url + profile.cape)).arrayBuffer())).rgba.subarray(0, 4)], [200, 10, 10, 255]);

    const cfgFile = path.join(instances.dirOf(inst.id), 'config', 'lumen-cloud.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgFile, 'utf8')), { enabled: true, url });
    cloud.set({ others: false });
    assert.equal(JSON.parse(fs.readFileSync(cfgFile, 'utf8')).enabled, false);

    cloud.set({ share: false });
    skins.setCape(paint(64, 32, [1, 2, 3, 255]));
    assert.equal(await cloud.push(), false, 'sharing off: nothing leaves the computer');
    assert.equal((await cloud.pushQuietly()).ok, false);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a dead service is reported, not thrown, by pushQuietly and check says why', async () => {
  cloud.set({ url: 'http://127.0.0.1:9', share: true });
  const r = await cloud.pushQuietly();
  assert.equal(r.ok, false);
  assert.ok(r.error);
  await assert.rejects(cloud.check(), /Could not reach/);
});

test('the built-in address is used when none was typed, and a typed one wins', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-cloud2-'));
  const server = createService({ data: dir, writesPerMin: 1000 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const built = `http://127.0.0.1:${server.address().port}`;
  const before = process.env.LUMEN_SKIN_SERVICE;
  try {
    cloud.set({ url: '', share: true, others: true });
    process.env.LUMEN_SKIN_SERVICE = '';
    assert.equal(cloud.view().active, '', 'a build without a service has nothing to talk to');
    assert.equal(await cloud.push(), false);
    process.env.LUMEN_SKIN_SERVICE = built;
    const v = cloud.view();
    assert.equal(v.builtIn, built);
    assert.equal(v.active, built);
    assert.equal(v.url, '', 'nothing was typed, the field stays empty');
    assert.equal((await cloud.check()).ok, true, 'check() asks the built-in service');
    assert.equal(await cloud.push(), true, 'the skin goes to the built-in service without any setup');
    cloud.set({ url: 'http://127.0.0.1:9' });
    assert.equal(cloud.view().active, 'http://127.0.0.1:9', 'a typed address wins');
    cloud.set({ url: '' });
  } finally {
    if (before === undefined) delete process.env.LUMEN_SKIN_SERVICE; else process.env.LUMEN_SKIN_SERVICE = before;
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deploy script: it can read the ids and addresses wrangler prints', () => {
  const { parseNamespaceId, parseWorkerUrl } = require('../../scripts/deploy-skin-service');
  assert.equal(parseNamespaceId('Add the following to your configuration file:\n[[kv_namespaces]]\nbinding = "SKINS"\nid = "0123456789abcdef0123456789abcdef"\n'), '0123456789abcdef0123456789abcdef');
  assert.equal(parseNamespaceId('{ "id": "abcdefabcdefabcdefabcdefabcdefab" }'), 'abcdefabcdefabcdefabcdefabcdefab');
  assert.equal(parseNamespaceId('nothing here'), null);
  assert.equal(parseWorkerUrl('Uploaded lumen-skins (1.2 sec)\nDeployed lumen-skins triggers\n  https://lumen-skins.pilot-7.workers.dev\nCurrent Version ID: x'), 'https://lumen-skins.pilot-7.workers.dev');
  assert.equal(parseWorkerUrl('no url'), null);
});
