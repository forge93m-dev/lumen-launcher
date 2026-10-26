// Needs internet: talks to the real Modrinth. Run with `npm run test:net`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox } = require('../helpers');
sandbox();
const instances = require('../../core/instances');
const mr = require('../../core/modrinth');
const doctor = require('../../core/doctor');
const { download } = require('../../core/net');

const mods = (id) => fs.readdirSync(path.join(instances.dirOf(id), 'mods')).sort();
const bySlug = (id, slug) => Object.values(instances.read(id).content).find((e) => e.slug === slug);
const fresh = (name, version = '1.21.1') => instances.create({ name, version, loader: 'fabric' });

test('three installs at once: every one is tracked, none is orphaned on disk', async () => {
  const inst = fresh('Concurrent');
  const r = await Promise.all(['sodium', 'lithium', 'zoomify'].map((s) => instances.installContent(inst.id, s, 'mod', { module: s }).then(() => 'ok', (e) => e.message)));
  assert.deepEqual(r, ['ok', 'ok', 'ok']);
  const tracked = Object.values(instances.read(inst.id).content).map((e) => e.file);
  assert.deepEqual(mods(inst.id).filter((f) => !tracked.includes(f)), []);
});

test('a mod\'s dependencies are installed, marked as dependencies, and protected from removal', async () => {
  const inst = fresh('Deps');
  await instances.installContent(inst.id, 'zoomify', 'mod', { module: 'zoomify' });
  const fabric = bySlug(inst.id, 'fabric-api');
  assert.equal(fabric.dependency, true);
  assert.ok(bySlug(inst.id, 'zoomify').needs.includes(fabric.id));
  await assert.rejects(() => instances.removeContent(inst.id, fabric.id), /required by/);
  const r = await instances.removeContent(inst.id, bySlug(inst.id, 'zoomify').id);
  assert.ok(r.removed.length >= 3);
  assert.equal(bySlug(inst.id, 'fabric-api'), undefined, 'its now-unused dependencies go with it');
});

test('a universal jar\'s dependencies for other loaders are ignored (Zoom installs on 26.3)', async () => {
  const inst = fresh('Universal', '26.3');
  const r = await instances.installContent(inst.id, 'zoomify', 'mod', { module: 'zoomify' });
  assert.ok(r.installed.some((t) => /Zoomify/.test(t)));
  assert.equal(Object.values(instances.read(inst.id).content).some((e) => /kotlin-lang-forge/.test(e.slug)), false);
});

test('a dependency that cannot be installed rolls the whole install back', async () => {
  const inst = fresh('Rollback');
  await instances.installContent(inst.id, 'sodium', 'mod');
  const before = JSON.stringify(Object.keys(instances.read(inst.id).content).sort());
  const files = JSON.stringify(mods(inst.id));
  const yacl = (await mr.getProject('yacl')).id;
  const original = mr.getCompatibleVersion;
  mr.getCompatibleVersion = async (p, ...rest) => (p === yacl ? null : original(p, ...rest));
  try {
    await assert.rejects(() => instances.installContent(inst.id, 'zoomify', 'mod'), /no build/);
  } finally {
    mr.getCompatibleVersion = original;
  }
  assert.equal(JSON.stringify(Object.keys(instances.read(inst.id).content).sort()), before);
  assert.equal(JSON.stringify(mods(inst.id)), files);
});

test('updating a disabled mod keeps it disabled and leaves one file', async () => {
  const inst = fresh('Disabled');
  await instances.installContent(inst.id, 'sodium', 'mod');
  await instances.toggleContent(inst.id, bySlug(inst.id, 'sodium').id, false);
  await instances.installContent(inst.id, 'sodium', 'mod');
  assert.equal(bySlug(inst.id, 'sodium').enabled, false);
  const files = mods(inst.id).filter((f) => f.startsWith('sodium'));
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('.disabled'));
});

test('doctor: finds a deleted jar and a missing dependency, and the fix restores them', async () => {
  const inst = fresh('Doctor', '26.3');
  await instances.installContent(inst.id, 'zoomify', 'mod', { module: 'zoomify' });
  const dir = path.join(instances.dirOf(inst.id), 'mods');
  const kotlin = bySlug(inst.id, 'fabric-language-kotlin');
  fs.rmSync(path.join(dir, kotlin.file));
  let pf = await doctor.preflight(inst.id);
  assert.deepEqual(pf.missingFiles.map((f) => f.title), ['Fabric Language Kotlin']);
  await doctor.fix(inst.id, { reinstall: pf.missingFiles.map((f) => f.id) });
  assert.ok(fs.existsSync(path.join(dir, bySlug(inst.id, 'fabric-language-kotlin').file)));

  const yacl = bySlug(inst.id, 'yacl');
  await instances.patch(inst.id, (i) => { delete i.content[yacl.id]; });
  fs.rmSync(path.join(dir, yacl.file));
  pf = await doctor.preflight(inst.id);
  assert.equal(pf.missingDeps.length, 1);
  assert.match(pf.missingDeps[0].title, /YetAnotherConfigLib|YACL/);
  assert.deepEqual(pf.missingDeps[0].needBy, ['Zoomify (Zoom)']);
  fs.writeFileSync(path.join(dir, 'handmade.jar'), 'x');
  assert.equal((await doctor.preflight(inst.id)).missingDeps.length, 0, 'hand-placed jars make the doctor back off');
  fs.rmSync(path.join(dir, 'handmade.jar'));
  await doctor.fix(inst.id, { install: pf.missingDeps.map((d) => d.id) });
  assert.equal(bySlug(inst.id, 'yacl').dependency, true);
});

test('doctor: Fabric mod ids are resolved to Modrinth projects (YACL has a different id), non-mods are skipped', async () => {
  const inst = fresh('Resolve', '26.3');
  const r = await doctor.resolve(inst.id, ['yet_another_config_lib_v3', 'fabric-language-kotlin', 'fabric-resource-loader-v0', 'minecraft', 'definitely_not_a_real_mod_xyz']);
  const titles = r.projects.map((p) => p.title);
  assert.ok(titles.some((t) => /YACL|YetAnotherConfigLib/.test(t)));
  assert.ok(titles.includes('Fabric API'));
  assert.deepEqual(r.unknown, ['definitely_not_a_real_mod_xyz']);
  assert.ok(!titles.some((t) => /MinecraftCapes/.test(t)));
});

test('doctor: a mod the launcher knows is repaired in place (jar deleted by hand, or switched off), not "installed" twice', async () => {
  const inst = fresh('KnownMods', '26.3');
  await instances.installContent(inst.id, 'zoomify', 'mod', { module: 'zoomify' });
  const dir = path.join(instances.dirOf(inst.id), 'mods');
  const yacl = bySlug(inst.id, 'yacl');
  fs.rmSync(path.join(dir, yacl.file)); // entry stays, file is gone
  let r = await doctor.resolve(inst.id, ['yet_another_config_lib_v3']);
  assert.deepEqual(r.projects.map((p) => p.action), ['reinstall']);
  await doctor.fix(inst.id, { install: r.projects.map((p) => p.id) });
  assert.ok(fs.existsSync(path.join(dir, bySlug(inst.id, 'yacl').file)));

  await instances.toggleContent(inst.id, yacl.id, false);
  r = await doctor.resolve(inst.id, ['yet_another_config_lib_v3']);
  assert.deepEqual(r.projects.map((p) => p.action), ['enable']);
  await doctor.fix(inst.id, { install: r.projects.map((p) => p.id) });
  assert.equal(bySlug(inst.id, 'yacl').enabled, true);
  assert.ok(fs.existsSync(path.join(dir, bySlug(inst.id, 'yacl').file)));
  assert.deepEqual((await doctor.resolve(inst.id, ['yet_another_config_lib_v3'])).projects, [], 'present and on: nothing to fix');
});

test('update check: one batched request, finds outdated (also disabled) mods, agrees with the per-mod lookup', async () => {
  const inst = fresh('Updates');
  const old = async (slug, disabled) => {
    const p = await mr.getProject(slug);
    const vs = (await mr.listVersions(slug, ['fabric'])).filter((v) => v.game_versions.includes('1.21.1') && v.version_type === 'release');
    const v = vs[vs.length - 1];
    const f = v.files.find((x) => x.primary) || v.files[0];
    await download(f.url, path.join(instances.dirOf(inst.id), 'mods', f.filename + (disabled ? '.disabled' : '')), { sha1: f.hashes.sha1, size: f.size });
    await instances.patch(inst.id, (i) => { i.content[p.id] = { id: p.id, slug, title: p.title, type: 'mod', file: f.filename, versionId: v.id, versionNumber: v.version_number, enabled: !disabled, needs: [] }; });
    return vs.length;
  };
  assert.ok((await old('lithium')) > 1);
  assert.ok((await old('sodium', true)) > 1);
  await instances.installContent(inst.id, 'ferrite-core', 'mod'); // already the newest
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = (u, o) => { calls.push(`${(o && o.method) || 'GET'} ${String(u).split('?')[0]}`); return realFetch(u, o); };
  let list;
  try { list = await instances.checkUpdates(inst.id); } finally { global.fetch = realFetch; }
  assert.deepEqual(list.map((u) => u.title).sort(), ['Lithium', 'Sodium']);
  assert.equal(calls.filter((c) => /POST .*version_files\/update/.test(c)).length, 1);
  assert.equal(calls.filter((c) => /GET .*\/project\/.*\/version/.test(c)).length, 0, 'no per-mod requests');
  for (const u of list) {
    const e = instances.read(inst.id).content[u.id];
    const v = await mr.getCompatibleVersion(e.id, e.type, '1.21.1', 'fabric', { fresh: true });
    assert.equal(v.version_number, u.to);
  }
});
