const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('../helpers').sandbox();
const nbt = require('../../core/nbt');
const servers = require('../../core/servers');
const instances = require('../../core/instances');
const T = nbt.T;

const everyType = () => new Map([
  ['byte', { type: T.BYTE, value: -5 }], ['short', { type: T.SHORT, value: -300 }], ['int', { type: T.INT, value: 123456 }],
  ['long', { type: T.LONG, value: -9007199254740993n }], ['float', { type: T.FLOAT, value: 1.5 }], ['double', { type: T.DOUBLE, value: -2.25 }],
  ['bytes', { type: T.BYTE_ARRAY, value: Buffer.from([1, 2, 3]) }], ['text', { type: T.STRING, value: 'héllo ✓' }],
  ['ints', { type: T.INT_ARRAY, value: [1, -2, 3] }], ['longs', { type: T.LONG_ARRAY, value: [1n, -2n] }],
  ['list', { type: T.LIST, value: { elementType: T.STRING, items: ['a', 'b'] } }],
  ['emptyList', { type: T.LIST, value: { elementType: T.END, items: [] } }],
  ['nested', { type: T.COMPOUND, value: new Map([['x', { type: T.INT, value: 7 }], ['deep', { type: T.LIST, value: { elementType: T.COMPOUND, items: [new Map([['k', { type: T.BYTE, value: 1 }]])] } }]]) }],
]);

test('NBT: every tag type survives read then write byte for byte', () => {
  const a = nbt.serialize({ name: '', value: everyType() });
  assert.equal(Buffer.compare(a, nbt.serialize(nbt.parse(a))), 0);
});

test('NBT: values come back with their types', () => {
  const back = nbt.parse(nbt.serialize({ name: 'root', value: everyType() }));
  assert.equal(back.name, 'root');
  assert.equal(back.value.get('long').value, -9007199254740993n); // beyond 2^53: needs BigInt
  assert.equal(back.value.get('text').value, 'héllo ✓');
  assert.deepEqual(back.value.get('ints').value, [1, -2, 3]);
});

test('NBT: a known byte sequence parses (format check independent of our writer)', () => {
  // compound "" { string "ip" = "a" }  as the game writes it
  const bytes = Buffer.from([10, 0, 0, 8, 0, 2, 0x69, 0x70, 0, 1, 0x61, 0]);
  const root = nbt.parse(bytes);
  assert.equal(root.value.get('ip').value, 'a');
});

test('NBT: truncated or garbage input throws instead of hanging', () => {
  const good = nbt.serialize({ name: '', value: everyType() });
  for (const bad of [good.subarray(0, 20), Buffer.from([10, 0, 0, 3, 0, 1, 120]), Buffer.from([1, 0, 0, 5]), Buffer.alloc(0), Buffer.from('not nbt')]) {
    assert.throws(() => nbt.parse(bad));
  }
});

test('NBT: absurdly deep nesting is refused', () => {
  const parts = [Buffer.from([10, 0, 0])];
  for (let i = 0; i < 100; i++) parts.push(Buffer.from([10, 0, 1, 97]));
  assert.throws(() => nbt.parse(Buffer.concat(parts)), /deeply/);
});

const mine = [{ name: 'Hypixel', address: 'mc.hypixel.net' }, { name: 'CubeCraft', address: 'play.cubecraft.net' }];
const ipsOf = (file) => [...nbt.parse(fs.readFileSync(file)).value.get('servers').value.items].map((m) => m.get('ip').value);

test('servers: creates servers.dat when the game has none, and is idempotent', () => {
  const inst = instances.create({ name: 'S1', version: '26.3', loader: 'fabric' });
  const file = path.join(instances.dirOf(inst.id), 'servers.dat');
  assert.equal(servers.sync(inst.id, mine), 2);
  assert.deepEqual(ipsOf(file), ['mc.hypixel.net', 'play.cubecraft.net']);
  const before = fs.readFileSync(file);
  assert.equal(servers.sync(inst.id, mine), 0);
  assert.equal(Buffer.compare(before, fs.readFileSync(file)), 0, 'file must not be rewritten when nothing changes');
});

test("servers: the player's own entries, icons and flags are preserved; duplicates are matched loosely", () => {
  const inst = instances.create({ name: 'S2', version: '26.3', loader: 'fabric' });
  const file = path.join(instances.dirOf(inst.id), 'servers.dat');
  const entry = (kv) => new Map(Object.entries(kv).map(([k, v]) => [k, typeof v === 'number' ? { type: T.BYTE, value: v } : { type: T.STRING, value: v }]));
  const root = { name: '', value: new Map([['servers', { type: T.LIST, value: { elementType: T.COMPOUND, items: [
    entry({ name: 'My Realm', ip: 'play.myrealm.net', icon: 'iVBORw0KGgo=', acceptTextures: 1, hidden: 0 }),
    entry({ name: 'Hypixel', ip: 'MC.HYPIXEL.NET:25565' }),
  ] } }]]) };
  fs.writeFileSync(file, nbt.serialize(root));
  assert.equal(servers.sync(inst.id, mine), 1, 'only CubeCraft is new (Hypixel matches despite case and :25565)');
  const items = nbt.parse(fs.readFileSync(file)).value.get('servers').value.items;
  assert.equal(items.length, 3);
  const realm = items.find((m) => m.get('name').value === 'My Realm');
  assert.equal(realm.get('icon').value, 'iVBORw0KGgo=');
  assert.equal(realm.get('acceptTextures').value, 1);
  assert.equal(items.find((m) => /hypixel/i.test(m.get('ip').value)).get('ip').value, 'MC.HYPIXEL.NET:25565');
});

test('servers: unreadable files are left alone and blank addresses are skipped', () => {
  const inst = instances.create({ name: 'S3', version: '26.3', loader: 'fabric' });
  const file = path.join(instances.dirOf(inst.id), 'servers.dat');
  fs.writeFileSync(file, 'this is not nbt');
  assert.equal(servers.sync(inst.id, mine), 0);
  assert.equal(fs.readFileSync(file, 'utf8'), 'this is not nbt');
  fs.writeFileSync(file, Buffer.from([0x1f, 0x8b, 8, 0])); // gzip magic
  assert.equal(servers.sync(inst.id, mine), 0);
  fs.rmSync(file);
  assert.equal(servers.sync(inst.id, [{ name: 'x', address: '  ' }, { name: 'y' }]), 0);
  assert.equal(fs.existsSync(file), false);
});
