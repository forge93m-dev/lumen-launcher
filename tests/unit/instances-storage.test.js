const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox, offline, rawZip, put } = require('../helpers');
sandbox();
offline();
const paths = require('../../core/paths');
const instances = require('../../core/instances');
const storage = require('../../core/storage');

const fresh = (name = 'T', over = {}) => instances.create({ name, version: '26.3', loader: 'fabric', ...over });
const mod = (id, title, needs = [], extra = {}) => ({ id, slug: id, title, type: 'mod', file: `${id}.jar`, versionNumber: '1', enabled: true, needs, ...extra });
const withMods = async (inst, entries) => {
  await instances.patch(inst.id, (i) => { for (const e of entries) i.content[e.id] = e; });
  for (const e of entries) put(path.join(instances.dirOf(inst.id), 'mods', e.enabled === false ? `${e.file}.disabled` : e.file), 5);
};

test('writes are atomic: no temp files are left behind', async () => {
  const inst = fresh();
  for (let i = 0; i < 20; i++) await instances.patch(inst.id, (x) => { x.playtime = i; });
  assert.deepEqual(fs.readdirSync(instances.dirOf(inst.id)).filter((f) => f.endsWith('.tmp')), []);
});

test('concurrent updates are serialised: none is lost', async () => {
  const inst = fresh();
  await Promise.all(Array.from({ length: 25 }, () => instances.patch(inst.id, async (x) => {
    const n = x.playtime || 0;
    await new Promise((r) => setTimeout(r, Math.random() * 5)); // yield, so a missing lock would interleave
    x.playtime = n + 1;
  })));
  assert.equal(instances.read(inst.id).playtime, 25);
});

test('a rename during other work survives (read-modify-write never clobbers)', async () => {
  const inst = fresh('Old');
  await Promise.all([instances.update(inst.id, { name: 'New' }), instances.patch(inst.id, (x) => { x.ram = 6144; })]);
  const r = instances.read(inst.id);
  assert.equal(r.name, 'New');
  assert.equal(r.ram, 6144);
});

test('changing version or loader forgets the pinned loader build', async () => {
  const inst = fresh();
  await instances.patch(inst.id, (x) => { x.loaderVersion = '0.20.1'; });
  await instances.update(inst.id, { name: 'same' });
  assert.equal(instances.read(inst.id).loaderVersion, '0.20.1');
  await instances.update(inst.id, { version: '26.2' });
  assert.equal(instances.read(inst.id).loaderVersion, null);
});

test('removing: a mod others need cannot go; unused auto-installed dependencies are swept', async () => {
  const inst = fresh();
  await withMods(inst, [
    mod('fabric', 'Fabric API', [], { dependency: true }), mod('yacl', 'YACL', ['fabric'], { dependency: true }),
    mod('zoom', 'Zoomify', ['fabric', 'yacl']), mod('sodium', 'Sodium'),
  ]);
  await assert.rejects(() => instances.removeContent(inst.id, 'fabric'), /required by Zoomify, YACL|required by YACL, Zoomify/);
  const r = await instances.removeContent(inst.id, 'zoom');
  assert.deepEqual([...r.removed].sort(), ['Fabric API', 'YACL', 'Zoomify']);
  assert.deepEqual(Object.keys(instances.read(inst.id).content), ['sodium'], 'a mod the user installed themselves is never swept');
  assert.deepEqual(fs.readdirSync(path.join(instances.dirOf(inst.id), 'mods')), ['sodium.jar']);
});

test('toggling renames the file and keeps the entry', async () => {
  const inst = fresh();
  await withMods(inst, [mod('a', 'A')]);
  await instances.toggleContent(inst.id, 'a', false);
  const dir = path.join(instances.dirOf(inst.id), 'mods');
  assert.deepEqual(fs.readdirSync(dir), ['a.jar.disabled']);
  assert.equal(instances.read(inst.id).content.a.enabled, false);
  await instances.toggleContent(inst.id, 'a', true);
  assert.deepEqual(fs.readdirSync(dir), ['a.jar']);
});

test('listContent separates tracked content from hand-placed files', async () => {
  const inst = fresh();
  await withMods(inst, [mod('a', 'A')]);
  put(path.join(instances.dirOf(inst.id), 'mods', 'handmade.jar'));
  put(path.join(instances.dirOf(inst.id), 'mods', 'off.jar.disabled'));
  const { tracked, local } = instances.listContent(inst.id);
  assert.deepEqual(tracked.map((e) => e.id), ['a']);
  assert.deepEqual(local.map((l) => [l.file, l.enabled]).sort(), [['handmade.jar', true], ['off.jar.disabled', false]]);
});

test('dropped files go to the right folder; unsupported ones are refused with a reason', async () => {
  const inst = fresh();
  const dir = path.join(paths.root, 'drops');
  fs.mkdirSync(dir, { recursive: true });
  const f = (name, entries) => { const p = path.join(dir, name); fs.writeFileSync(p, rawZip(entries)); return p; };
  const files = [
    f('fab.jar', [{ name: 'fabric.mod.json', data: '{}' }]), f('forge.jar', [{ name: 'META-INF/mods.toml', data: 'x' }]),
    f('pack.zip', [{ name: 'pack.mcmeta', data: '{}' }]), f('shader.zip', [{ name: 'shaders/a.fsh', data: 'x' }]),
    f('vague.zip', [{ name: 'readme.txt', data: 'x' }]), path.join(dir, 'notes.txt'), path.join(dir, 'broken.jar'),
  ];
  fs.writeFileSync(files[5], 'hi');
  fs.writeFileSync(files[6], 'not a zip');
  const r = await instances.addFiles(inst.id, files, undefined);
  const where = (sub) => fs.readdirSync(path.join(instances.dirOf(inst.id), sub));
  assert.deepEqual(r.added.map((a) => a.file).sort(), ['fab.jar', 'pack.zip', 'shader.zip']);
  assert.ok(where('mods').includes('fab.jar') && where('resourcepacks').includes('pack.zip') && where('shaderpacks').includes('shader.zip'));
  const why = Object.fromEntries(r.rejected.map((x) => [x.file, x.reason]));
  assert.match(why['forge.jar'], /Forge|NeoForge/);
  assert.match(why['vague.zip'], /isn't a resource pack or shader pack/);
  assert.match(why['notes.txt'], /unsupported type/);
  assert.match(why['broken.jar'], /not a valid/);
  const hinted = await instances.addFiles(inst.id, [files[4]], 'resourcepack');
  assert.equal(hinted.added.length, 1, 'a tab hint resolves an ambiguous zip');
  const van = instances.create({ name: 'V', version: '26.3', loader: 'vanilla' });
  const rv = await instances.addFiles(van.id, [files[0]], undefined);
  assert.match(rv.rejected[0].reason, /vanilla/);
});

test('duplicate: same setup, no worlds/logs unless asked, fully independent', async () => {
  const src = fresh('Source');
  const d = instances.dirOf(src.id);
  await instances.patch(src.id, (i) => { i.ram = 6144; i.playtime = 999; i.lastPlayed = 5; i.loaderVersion = '0.20.1'; });
  await withMods(src, [mod('a', 'A')]);
  put(path.join(d, 'saves', 'W1', 'level.dat'), 4); put(path.join(d, 'logs', 'latest.log')); put(path.join(d, 'screenshots', 's.png')); put(path.join(d, 'options.txt'), 3);
  const c = await instances.duplicate(src.id, 'Copy');
  const cd = instances.dirOf(c.id);
  assert.equal(c.ram, 6144); assert.equal(c.loaderVersion, '0.20.1'); assert.equal(c.playtime, 0); assert.equal(c.lastPlayed, null);
  assert.deepEqual(Object.keys(c.content), ['a']);
  assert.ok(fs.existsSync(path.join(cd, 'mods', 'a.jar')) && fs.existsSync(path.join(cd, 'options.txt')));
  for (const gone of ['saves', 'logs', 'screenshots']) assert.equal(fs.existsSync(path.join(cd, gone)), false, gone);
  const w = await instances.duplicate(src.id, 'With worlds', { worlds: true });
  assert.ok(fs.existsSync(path.join(instances.dirOf(w.id), 'saves', 'W1', 'level.dat')));
  put(path.join(cd, 'mods', 'only-in-copy.jar'));
  assert.equal(fs.existsSync(path.join(d, 'mods', 'only-in-copy.jar')), false);
});

// ---------- storage ----------

const V = (id, component) => { put(path.join(paths.versions, id, `${id}.jar`), 3000); fs.writeFileSync(path.join(paths.versions, id, `${id}.json`), JSON.stringify({ id, javaVersion: { component } })); };

test('storage: sizes are exact (parallel directory walks must not lose bytes)', async () => {
  const dir = path.join(paths.libraries, 'deep');
  let expected = 0;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 4; c++) { put(path.join(dir, `a${a}`, `b${b}`, `f${c}.bin`), 100 + a + b + c); expected += 100 + a + b + c; }
  const u = await storage.usage();
  assert.equal(u.parts.find((p) => p.key === 'libraries').bytes, expected);
});

test('storage: only versions and Java that no instance needs are reported and removed', async () => {
  // Instances from the tests above (one moved to a version that was never downloaded) would, correctly, make the
  // cleanup cautious about Java. Start from a clean slate so this test is about the cleanup rules only.
  for (const i of instances.list()) await instances.remove(i.id);
  const inst = fresh('Used');
  await instances.patch(inst.id, (i) => { i.loaderVersion = '0.20.1'; });
  V('26.3', 'java-runtime-epsilon'); V('fabric-loader-0.20.1-26.3', 'java-runtime-epsilon');
  V('1.8.9', 'jre-legacy'); V('fabric-loader-0.19.0-1.8.9', 'jre-legacy'); V('1.20.4', 'java-runtime-gamma');
  for (const r of ['java-runtime-epsilon', 'jre-legacy', 'java-runtime-gamma']) put(path.join(paths.runtimes, r, 'bin', 'java'), 100);
  put(path.join(paths.libraries, 'keep.jar'), 10);

  let u = await storage.usage();
  assert.deepEqual(u.unused.versions.map((v) => v.id).sort(), ['1.20.4', '1.8.9', 'fabric-loader-0.19.0-1.8.9']);
  assert.deepEqual(u.unused.runtimes.map((r) => r.id).sort(), ['java-runtime-gamma', 'jre-legacy']);

  // never launched: no version json, loader not pinned -> keeps its version, every loader build for it, and all Java
  const fresh2 = fresh('Fresh', { version: '1.8.9' });
  fs.rmSync(path.join(paths.versions, '1.8.9', '1.8.9.json'));
  u = await storage.usage();
  assert.ok(!u.unused.versions.some((v) => /1\.8\.9/.test(v.id)));
  assert.equal(u.unused.runtimes.length, 0, 'unknown Java needs: do not touch any runtime');
  await instances.remove(fresh2.id);
  fs.writeFileSync(path.join(paths.versions, '1.8.9', '1.8.9.json'), JSON.stringify({ id: '1.8.9', javaVersion: { component: 'jre-legacy' } }));

  const r = await storage.clean();
  assert.ok(r.freed > 0 && r.removed.length === 5);
  for (const gone of [['versions', '1.8.9'], ['versions', '1.20.4'], ['versions', 'fabric-loader-0.19.0-1.8.9'], ['runtimes', 'jre-legacy'], ['runtimes', 'java-runtime-gamma']]) {
    assert.equal(fs.existsSync(path.join(paths[gone[0]], gone[1])), false, gone.join('/'));
  }
  for (const kept of [['versions', '26.3'], ['versions', 'fabric-loader-0.20.1-26.3'], ['runtimes', 'java-runtime-epsilon'], ['libraries', 'keep.jar']]) {
    assert.ok(fs.existsSync(path.join(paths[kept[0]], kept[1])), kept.join('/'));
  }
  assert.equal((await storage.usage()).unused.bytes, 0);
});
