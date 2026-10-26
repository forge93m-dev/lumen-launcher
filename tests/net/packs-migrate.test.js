// Needs internet: talks to the real Modrinth. Run with `npm run test:net`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sandbox, rawZip } = require('../helpers');
sandbox();
const instances = require('../../core/instances');
const packs = require('../../core/packs');
const hud = require('../../core/hud');
const migrate = require('../../core/migrate');
const mr = require('../../core/modrinth');
const AdmZip = require('adm-zip');

const sha1 = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const mods = (id) => fs.readdirSync(path.join(instances.dirOf(id), 'mods')).sort();

test('modpack export then import: the same mods, verified by checksum, recognised on Modrinth', async () => {
  const inst = instances.create({ name: 'Packer', version: '26.3', loader: 'fabric' });
  for (const s of ['sodium', 'lithium', 'zoomify']) await instances.installContent(inst.id, s, 'mod', { module: s });
  await hud.install(inst.id);
  fs.writeFileSync(path.join(instances.dirOf(inst.id), 'mods', 'handmade.jar'), 'hand-made jar');
  fs.mkdirSync(path.join(instances.dirOf(inst.id), 'config'), { recursive: true });
  fs.writeFileSync(path.join(instances.dirOf(inst.id), 'config', 'test.json'), '{"a":1}');
  const tracked = Object.values(instances.read(inst.id).content).filter((e) => !e.builtin);

  const out = path.join(path.dirname(instances.dirOf(inst.id)), '..', 'export.mrpack');
  await packs.exportMrpack(inst.id, out);
  const zip = new AdmZip(out);
  const index = JSON.parse(zip.getEntry('modrinth.index.json').getData().toString());
  assert.equal(index.files.length, tracked.length);
  assert.ok(index.files.every((f) => /^https:\/\/cdn\.modrinth\.com\//.test(f.downloads[0]) && f.hashes.sha1));
  assert.equal(index.dependencies.minecraft, '26.3');
  const names = zip.getEntries().map((e) => e.entryName);
  for (const bundled of ['overrides/mods/handmade.jar', 'overrides/config/test.json']) assert.ok(names.includes(bundled), bundled);
  assert.ok(names.some((n) => /^overrides\/mods\/lumenhud/.test(n)), 'Lumen HUD is not on Modrinth, so it travels inside the pack');

  const imp = await packs.importMrpack(out, { onStatus: () => {} });
  const dir = instances.dirOf(imp.id);
  assert.ok(index.files.every((f) => sha1(path.join(dir, f.path)) === f.hashes.sha1));
  assert.equal(fs.readFileSync(path.join(dir, 'config', 'test.json'), 'utf8'), '{"a":1}');
  assert.equal(Object.keys(imp.content).length, tracked.length, 'every mod is identified on Modrinth and tracked');
});

test('modpack import: a wrong checksum fails the download and leaves nothing behind', async () => {
  const sodium = await mr.getCompatibleVersion('sodium', 'mod', '26.3', 'fabric');
  const f = sodium.files[0];
  const index = { formatVersion: 1, game: 'minecraft', versionId: '1', name: 'Bad', dependencies: { minecraft: '26.3', 'fabric-loader': '0.20.1' },
    files: [{ path: `mods/${f.filename}`, hashes: { sha1: '0'.repeat(40) }, downloads: [f.url], fileSize: f.size }] };
  const file = path.join(path.dirname(instances.dirOf('x')), '..', 'bad.mrpack');
  fs.writeFileSync(file, rawZip([{ name: 'modrinth.index.json', data: JSON.stringify(index) }]));
  const before = instances.list().length;
  await assert.rejects(() => packs.importMrpack(file), /Could not download/);
  assert.equal(instances.list().length, before);
});

test('changing the Minecraft version: mods follow, ones without a build are switched off, the HUD build is swapped', async () => {
  const inst = instances.create({ name: 'Mover', version: '1.21.1', loader: 'fabric' });
  const id = inst.id;
  for (const s of ['sodium', 'lithium']) await instances.installContent(id, s, 'mod', { module: s });
  // a popular mod that exists for 1.21.1 but has no 26.3 build yet (looked up live, so the test ages gracefully)
  let stray = null;
  for (const h of (await mr.search({ type: 'mod', gameVersion: '1.21.1', loader: 'fabric', sort: 'downloads', limit: 40 })).hits) {
    if (['sodium', 'lithium', 'fabric-api'].includes(h.slug)) continue;
    if (!(await mr.getCompatibleVersion(h.project_id, 'mod', '26.3', 'fabric', { fresh: true }))) {
      try { await instances.installContent(id, h.project_id, 'mod'); stray = h; break; } catch {}
    }
  }
  await hud.install(id);

  const plan = await migrate.plan(id, '26.3');
  assert.ok(['Sodium', 'Lithium'].every((t) => plan.ok.map((m) => m.title).includes(t)));
  assert.equal(plan.hud, 'keep');
  assert.equal(instances.read(id).version, '1.21.1', 'planning changes nothing');
  if (stray) assert.ok(plan.missing.some((m) => m.title === stray.title));

  const r = await migrate.apply(id, '26.3');
  const after = instances.read(id);
  assert.equal(after.version, '26.3');
  assert.equal(after.loaderVersion, null);
  assert.deepEqual(r.failed, []);
  for (const s of ['sodium', 'lithium']) assert.match(Object.values(after.content).find((e) => e.slug === s).file, /26\.3/);
  const huds = mods(id).filter((f) => /lumenhud/.test(f));
  assert.equal(huds.length, 1);
  assert.match(huds[0], /\+26\.3\.jar$/);
  if (stray) {
    const e = Object.values(after.content).find((x) => x.slug === stray.slug);
    assert.equal(e.enabled, false);
    assert.equal(e.incompatible, '26.3');
  }

  const p2 = await migrate.plan(id, '1.20.4');
  assert.equal(p2.hud, 'remove');
  await migrate.apply(id, '1.20.4');
  assert.equal(instances.read(id).content['lumen-hud'], undefined);
  assert.deepEqual(mods(id).filter((f) => /lumenhud/.test(f)), []);
});
