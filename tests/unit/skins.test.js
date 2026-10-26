const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox } = require('../helpers');
sandbox();
const instances = require('../../core/instances');
const png = require('../../core/png');
const skins = require('../../core/skins');

const paint = (w, h, fn) => {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.set(fn(x, y), (y * w + x) * 4);
  return rgba;
};
const px = (rgba, w, x, y) => [...rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];

test('png: what is written can be read back, pixel for pixel', () => {
  const rgba = paint(5, 3, (x, y) => [x * 40, y * 80, 7, x === 2 ? 0 : 255]);
  const back = png.decode(png.encode(rgba, 5, 3));
  assert.equal(back.width, 5);
  assert.equal(back.height, 3);
  assert.deepEqual([...back.rgba], [...rgba]);
});

test('png: damaged or foreign files are refused with a clear message', () => {
  assert.throws(() => png.decode(Buffer.from('GIF89a not a png at all, just some bytes here.....')), /not a PNG/);
  const good = png.encode(paint(2, 2, () => [1, 2, 3, 255]), 2, 2);
  assert.throws(() => png.decode(good.subarray(0, 40)), /damaged|PNG/);
});

test('skin: an old 64x32 skin gets its left limbs mirrored from the right ones, like the game does', () => {
  const old = paint(64, 32, (x, y) => (x === 4 && y === 16 ? [255, 0, 0, 255] : [10, 10, 10, 255])); // a mark on the right leg
  const out = skins.normalize(old, 64, 32);
  assert.equal(out.length, 64 * 64 * 4);
  // right leg (4..7, 16..31) is copied mirrored to the left leg at (20..23, 48..63): x 4 -> 23, y 16 -> 48
  assert.deepEqual(px(out, 64, 23, 48), [255, 0, 0, 255]);
});

test('skin: a 128x128 skin is shrunk, and the body is never see-through', () => {
  const big = paint(128, 128, (x, y) => [x % 256, y % 256, 0, 0]);
  const out = skins.normalize(big, 128, 128);
  assert.equal(px(out, 64, 10, 10)[3], 255, 'head is opaque');
  assert.equal(px(out, 64, 40, 40)[3], 0, 'the clothing layer keeps its transparency');
  assert.deepEqual(px(out, 64, 40, 40).slice(0, 2), [80, 80], 'every second pixel is taken');
});

test('skin: other sizes are refused', () => {
  assert.throws(() => skins.normalize(Buffer.alloc(50 * 50 * 4), 50, 50), /64/);
});

test('library: adding makes a skin active, models and removal work, and it survives a reload', () => {
  const file = png.encode(paint(64, 64, () => [200, 30, 30, 255]), 64, 64);
  const id = skins.add(file, { name: 'Red <b>one</b>', model: 'slim' });
  const list = skins.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].active, true);
  assert.equal(list[0].model, 'slim');
  assert.equal(list[0].name, 'Red bone/b'.replace('/', ''), 'odd characters are dropped from names');
  skins.update(id, { model: 'classic' });
  assert.equal(skins.list()[0].model, 'classic');
  assert.throws(() => skins.update(id, { model: 'huge' }), /classic or slim/);
  const second = skins.add(file, { name: 'Second' });
  assert.equal(skins.list().find((s) => s.id === second).active, true);
  skins.setActive(null);
  assert.equal(skins.list().some((s) => s.active), false);
  skins.remove(id);
  assert.equal(skins.list().length, 1);
  assert.equal(png.decode(skins.read(second)).width, 64);
});

test('sync: the active skin lands in instances with Lumen HUD and nowhere else; switching it off says so', () => {
  const withHud = instances.create({ name: 'WithHud', version: '26.3', loader: 'fabric' });
  const plain = instances.create({ name: 'Plain', version: '26.3', loader: 'fabric' });
  const file = png.encode(paint(64, 64, () => [0, 200, 0, 255]), 64, 64);
  const j = JSON.parse(JSON.stringify(instances.read(withHud.id)));
  j.content['lumen-hud'] = { id: 'lumen-hud', slug: 'lumen-hud', title: 'Lumen HUD', type: 'mod', file: 'x.jar', enabled: true, needs: [] };
  fs.writeFileSync(path.join(instances.dirOf(withHud.id), 'instance.json'), JSON.stringify(j));
  const id = skins.add(file, { name: 'Green', model: 'slim' });
  skins.setActive(id);
  skins.syncAll();
  const cfg = path.join(instances.dirOf(withHud.id), 'config');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(cfg, 'lumen-skin.json'), 'utf8')), { enabled: true, slim: true, cape: false });
  assert.equal(png.decode(fs.readFileSync(path.join(cfg, 'lumen-skin.png'))).width, 64);
  assert.equal(fs.existsSync(path.join(instances.dirOf(plain.id), 'config', 'lumen-skin.png')), false);
  skins.setActive(null);
  skins.syncAll();
  assert.equal(JSON.parse(fs.readFileSync(path.join(cfg, 'lumen-skin.json'), 'utf8')).enabled, false);
});

test('nickname: the profile is read from Mojang, only a textures.minecraft.net picture is accepted', async () => {
  const textures = (url, model) => Buffer.from(JSON.stringify({ textures: { SKIN: { url, ...(model ? { metadata: { model } } : {}) } } })).toString('base64');
  const api = (url) => async (u) => {
    if (u.startsWith('https://api.mojang.com/users/profiles/minecraft/')) return { id: 'a'.repeat(32), name: 'Notch' };
    return { name: 'Notch', properties: [{ name: 'textures', value: textures(url, 'slim') }] };
  };
  const ok = await skins.fetchProfile('Notch', api('https://textures.minecraft.net/texture/abc123'));
  assert.deepEqual(ok, { name: 'Notch', url: 'https://textures.minecraft.net/texture/abc123', slim: true });
  await assert.rejects(skins.fetchProfile('Notch', api('https://evil.example/texture/abc123')), /no custom skin/);
  await assert.rejects(skins.fetchProfile('x', api('')), /3–16/);
  await assert.rejects(skins.fetchProfile('Nobody', async () => { throw new Error('HTTP 404 for x'); }), /No player called Nobody/);
  const id = await skins.addFromNickname('Notch', { json: api('https://textures.minecraft.net/texture/abc123'), bytes: async () => png.encode(paint(64, 32, () => [9, 9, 9, 255]), 64, 32) });
  assert.equal(skins.list().find((s) => s.id === id).model, 'slim');
});

test('cape: 64x32, 22x17 and larger capes become a 64x32 picture; other sizes are refused', () => {
  const small = paint(22, 17, () => [9, 8, 7, 255]);
  const out = skins.normalizeCape(small, 22, 17);
  assert.equal(out.length, 64 * 32 * 4);
  assert.deepEqual(px(out, 64, 21, 16), [9, 8, 7, 255], 'the 22x17 picture sits in the corner');
  assert.deepEqual(px(out, 64, 22, 0), [0, 0, 0, 0]);
  const big = skins.normalizeCape(paint(128, 64, (x) => [x % 256, 0, 0, 255]), 128, 64);
  assert.deepEqual(px(big, 64, 5, 5), [10, 0, 0, 255], 'every second pixel is taken');
  assert.throws(() => skins.normalizeCape(Buffer.alloc(40 * 40 * 4), 40, 40), /64/);
});

test('cape: one slot; it is written next to the skin, and "cape: false" is written when it is removed', () => {
  const inst = instances.create({ name: 'CapeHud', version: '26.3', loader: 'fabric' });
  const j = JSON.parse(fs.readFileSync(path.join(instances.dirOf(inst.id), 'instance.json'), 'utf8'));
  j.content['lumen-hud'] = { id: 'lumen-hud', slug: 'lumen-hud', title: 'Lumen HUD', type: 'mod', file: 'x.jar', enabled: true, needs: [] };
  fs.writeFileSync(path.join(instances.dirOf(inst.id), 'instance.json'), JSON.stringify(j));
  skins.setActive(null);
  assert.equal(skins.hasCape(), false);
  skins.setCape(png.encode(paint(64, 32, () => [250, 0, 0, 255]), 64, 32));
  assert.equal(skins.hasCape(), true);
  skins.syncAll();
  const cfg = path.join(instances.dirOf(inst.id), 'config');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(cfg, 'lumen-skin.json'), 'utf8')), { enabled: false, slim: false, cape: true });
  assert.equal(png.decode(fs.readFileSync(path.join(cfg, 'lumen-cape.png'))).height, 32);
  skins.clearCape();
  skins.syncAll();
  assert.equal(JSON.parse(fs.readFileSync(path.join(cfg, 'lumen-skin.json'), 'utf8')).cape, false);
});
