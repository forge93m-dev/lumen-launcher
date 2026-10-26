const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox, offline, rawZip } = require('../helpers');
sandbox();
offline();
const instances = require('../../core/instances');
const active = require('../../core/active');
const packs = require('../../core/packs');

const fresh = (name = 'T') => instances.create({ name, version: '26.3', loader: 'fabric' });

// ---------- switching resource/shader packs on ----------

test('resource packs: options.txt is created, edited in place, and other settings survive', () => {
  const inst = fresh();
  const opt = path.join(instances.dirOf(inst.id), 'options.txt');
  active.use(inst.id, 'resourcepack', 'A.zip', true);
  assert.equal(fs.readFileSync(opt, 'utf8').trim(), 'resourcePacks:["vanilla","file/A.zip"]');

  fs.writeFileSync(opt, 'version:4189\r\nsoundCategory_master:0.5\r\nresourcePacks:["vanilla","fabric","file/B.zip"]\r\nfov:0.7\r\n');
  active.use(inst.id, 'resourcepack', 'A.zip', true);
  const txt = fs.readFileSync(opt, 'utf8');
  assert.match(txt, /resourcePacks:\["vanilla","fabric","file\/B\.zip","file\/A\.zip"\]/);
  for (const keep of ['soundCategory_master:0.5', 'fov:0.7', 'version:4189']) assert.ok(txt.includes(keep), keep);

  active.use(inst.id, 'resourcepack', 'B.zip', false);
  assert.deepEqual(active.get(inst.id).resourcepacks, ['A.zip']);
  active.use(inst.id, 'resourcepack', 'B.zip', true);
  active.use(inst.id, 'resourcepack', 'A.zip', true);
  assert.deepEqual(active.get(inst.id).resourcepacks, ['B.zip', 'A.zip'], 'switching on again moves a pack to the top priority');
});

test('resource packs: a path in the name is reduced to a file name', () => {
  const inst = fresh();
  active.use(inst.id, 'resourcepack', '../../evil.zip', true);
  assert.deepEqual(active.get(inst.id).resourcepacks, ['evil.zip']);
});

test('shaders: Iris config is created, updated in place and switched off', () => {
  const inst = fresh();
  const iris = path.join(instances.dirOf(inst.id), 'config', 'iris.properties');
  active.use(inst.id, 'shader', 'S1.zip', true);
  assert.equal(active.get(inst.id).shader, 'S1.zip');
  fs.writeFileSync(iris, '#comment\ndisableUpdateMessage=true\nenableShaders=false\nshaderPack=Old.zip\n');
  active.use(inst.id, 'shader', 'S2.zip', true);
  const txt = fs.readFileSync(iris, 'utf8');
  for (const keep of ['#comment', 'disableUpdateMessage=true', 'shaderPack=S2.zip', 'enableShaders=true']) assert.ok(txt.includes(keep), keep);
  assert.ok(!txt.includes('Old.zip'));
  active.use(inst.id, 'shader', 'S2.zip', false);
  assert.equal(active.get(inst.id).shader, null);
});

test('only packs can be switched on', () => {
  assert.throws(() => active.use(fresh().id, 'mod', 'x.jar', true), /Only resource packs and shader packs/);
});

// ---------- importing modpacks: hostile archives ----------

const base = (over = {}) => ({ formatVersion: 1, game: 'minecraft', versionId: '1', name: 'Evil', files: [], dependencies: { minecraft: '26.3', 'fabric-loader': '0.20.1' }, ...over });
const goodFile = { path: 'mods/a.jar', hashes: { sha1: 'a'.repeat(40) }, downloads: ['https://cdn.modrinth.com/data/x/versions/y/a.jar'], fileSize: 1 };
const pack = (name, index, extra = []) => {
  const file = path.join(path.dirname(instances.dirOf('x')), '..', `${name}.mrpack`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rawZip([{ name: 'modrinth.index.json', data: JSON.stringify(index) }, ...extra]));
  return file;
};
const refused = async (file, pattern) => {
  const before = instances.list().length;
  await assert.rejects(() => packs.importMrpack(file), pattern);
  assert.equal(instances.list().length, before, 'a refused pack must not leave an instance behind');
};

test('modpack safeRel: traversal and absolute paths are rejected, harmless ones normalised', () => {
  for (const bad of ['../x', '/abs', 'C:/x', 'a/../../b', '', '\0']) assert.throws(() => packs.safeRel(bad), /Unsafe path/, bad);
  assert.equal(packs.safeRel('mods/a.jar'), 'mods/a.jar');
  assert.equal(packs.safeRel('a/./b/../c.txt'), 'a/c.txt');
});

test('modpack: path traversal in files, overrides, and from a hand-built archive is refused', async () => {
  await refused(pack('t1', base({ files: [{ ...goodFile, path: '../evil.jar' }] })), /Unsafe path/);
  await refused(pack('t2', base(), [{ name: 'overrides/../../escaped.txt', data: 'x' }]), /Unsafe path/);
});

test('modpack: only https from trusted hosts is accepted', async () => {
  await refused(pack('t3', base({ files: [{ ...goodFile, downloads: ['https://evil.example.com/x.jar'] }] })), /trusted download source/);
  await refused(pack('t4', base({ files: [{ ...goodFile, downloads: ['http://cdn.modrinth.com/x.jar'] }] })), /trusted download source/);
  await refused(pack('t5', base({ files: [{ ...goodFile, downloads: ['https://cdn.modrinth.com.evil.example/x.jar'] }] })), /trusted download source/);
});

test('modpack: missing checksum, unsupported loader, broken or foreign archives get clear errors', async () => {
  await refused(pack('t6', base({ files: [{ ...goodFile, hashes: {} }] })), /checksum/);
  await refused(pack('t7', base({ dependencies: { minecraft: '1.21.1', neoforge: '21.1.0' } })), /NeoForge[^]*can't launch/);
  await refused(pack('t8', base({ dependencies: { minecraft: '1.20.1', forge: '47.0' } })), /Forge/);
  await refused(pack('t9', base({ formatVersion: 2 })), /Unsupported modpack format/);
  await refused(pack('t10', base({ dependencies: {} })), /Minecraft version/);
  const junk = path.join(path.dirname(instances.dirOf('x')), '..', 'junk.mrpack');
  fs.writeFileSync(junk, 'definitely not a zip');
  await refused(junk, /not a valid modpack/);
  const noIndex = path.join(path.dirname(instances.dirOf('x')), '..', 'noindex.mrpack');
  fs.writeFileSync(noIndex, rawZip([{ name: 'readme.txt', data: 'hi' }]));
  await refused(noIndex, /modrinth\.index\.json is missing/);
});

test('modpack: an empty valid pack imports as an instance with overrides applied', async () => {
  const file = pack('ok', base({ name: 'Tiny Pack' }), [{ name: 'overrides/config/x.json', data: '{"a":1}' }, { name: 'client-overrides/options.txt', data: 'fov:1' }]);
  const inst = await packs.importMrpack(file, { onStatus: () => {} });
  assert.equal(inst.name, 'Tiny Pack');
  assert.equal(inst.version, '26.3');
  assert.equal(inst.loader, 'fabric');
  assert.equal(inst.loaderVersion, '0.20.1');
  const dir = instances.dirOf(inst.id);
  assert.equal(fs.readFileSync(path.join(dir, 'config', 'x.json'), 'utf8'), '{"a":1}');
  assert.equal(fs.readFileSync(path.join(dir, 'options.txt'), 'utf8'), 'fov:1');
});
