const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox } = require('../helpers');
sandbox();
const instances = require('../../core/instances');
const graphics = require('../../core/graphics');

const file = (inst) => path.join(instances.dirOf(inst.id), 'options.txt');
const lines = (inst) => fs.readFileSync(file(inst), 'utf8').split('\n').filter(Boolean);

test('graphics: a profile sets its lines and leaves every other option alone', () => {
  const inst = instances.create({ name: 'G', version: '26.3', loader: 'fabric' });
  fs.writeFileSync(file(inst), 'lang:ru_ru\nrenderDistance:16\nmaxFps:144\nkey_key.jump:key.keyboard.space\nparticles:0\n');
  graphics.apply(inst.id, 'performance');
  const l = lines(inst);
  assert.ok(l.includes('renderDistance:8') && l.includes('graphicsMode:0') && l.includes('particles:1'));
  assert.ok(l.includes('lang:ru_ru') && l.includes('maxFps:144') && l.includes('key_key.jump:key.keyboard.space'), 'unrelated options stay');
  assert.equal(l.filter((x) => x.startsWith('renderDistance:')).length, 1, 'no duplicated lines');
});

test('graphics: the current profile is recognised, and "custom" is null', () => {
  const inst = instances.create({ name: 'G2', version: '26.3', loader: 'fabric' });
  assert.equal(graphics.current(inst.id), null, 'no options file yet');
  for (const p of graphics.PROFILES) {
    graphics.apply(inst.id, p.id);
    assert.equal(graphics.current(inst.id), p.id, p.id);
  }
  fs.appendFileSync(file(inst), 'renderDistance:13\n');
  const l = lines(inst).filter((x) => !x.startsWith('renderDistance:'));
  fs.writeFileSync(file(inst), `${l.join('\n')}\nrenderDistance:13\n`);
  assert.equal(graphics.current(inst.id), null);
});

test('graphics: an unknown profile is refused and the file is created when it is missing', () => {
  const inst = instances.create({ name: 'G3', version: '26.3', loader: 'fabric' });
  assert.throws(() => graphics.apply(inst.id, 'ultra'), /Unknown/);
  graphics.apply(inst.id, 'potato');
  assert.ok(fs.existsSync(file(inst)));
  assert.deepEqual(graphics.list().map((p) => p.id), ['quality', 'balanced', 'performance', 'potato']);
});
