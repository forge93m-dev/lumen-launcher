// Starts the real game. Slow, downloads Minecraft on the first run, and needs a display. `npm run test:game`.
// Downloads are cached between runs in <tmp>/lumen-game-test-cache; the game runs with sound off.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.LUMEN_HOME = path.join(os.tmpdir(), 'lumen-game-test-cache');
const game = require('../../core/game');
const instances = require('../../core/instances');
const hud = require('../../core/hud');
const doctor = require('../../core/doctor');

const VERSIONS = (process.env.LUMEN_TEST_VERSIONS || '26.3').split(',');
const account = { name: 'LumenTest', uuid: '11111111-1111-3111-8111-111111111111' };

// Runs the game until `ready` matches a log line (then stops it) or the report watcher fires.
async function run(inst, { ram = 3072, ready = /Sound engine started|Created: \d+x\d+/, timeout = 180000 } = {}) {
  const i = instances.read(inst.id);
  const ctx = await game.prepare(i, () => {});
  await instances.patch(inst.id, (x) => { x.loaderVersion = i.loaderVersion; });
  const lines = [];
  let outcome = 'timeout';
  let problem = null;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { proc.kill(); resolve(); }, timeout);
    const stop = (why, ms) => { if (outcome !== 'timeout') return; outcome = why; clearTimeout(timer); setTimeout(() => proc.kill(), ms); };
    const watch = doctor.createWatcher((p) => { problem = p; stop('fabric-error', 500); }, () => stop('out-of-memory', 1500));
    const proc = lowPriority(game.launch(ctx, { inst: i, gameDir: instances.dirOf(inst.id), account, settings: { ram, jvmArgs: '-XX:ActiveProcessorCount=2' } }, {
      onLog: (l) => { lines.push(l); watch(l); if (ready.test(l)) stop('started', 2500); },
      onExit: () => { clearTimeout(timer); resolve(); },
    }));
  });
  await new Promise((r) => setTimeout(r, 2500)); // let the process release its files
  return { outcome, lines, problem };
}

const { LOW_GRAPHICS, lowPriority } = require('./lib');
const quiet = (inst) => fs.writeFileSync(path.join(instances.dirOf(inst.id), 'options.txt'), LOW_GRAPHICS);
const cleanup = (inst) => instances.remove(inst.id);

for (const version of VERSIONS) {
  test(`${version}: the game starts with Sodium and Lumen HUD`, { timeout: 600000 }, async () => {
    const inst = instances.create({ name: `GAME ${version}`, version, loader: 'fabric' });
    quiet(inst);
    await hud.install(inst.id);
    await instances.installContent(inst.id, 'sodium', 'mod');
    const r = await run(inst);
    assert.equal(r.outcome, 'started', r.problem ? JSON.stringify(r.problem.details) : r.lines.slice(-5).join('\n'));
    assert.ok(r.lines.some((l) => /Lumen HUD ready/.test(l)), 'Lumen HUD should load');
    await cleanup(inst);
  });
}

test('a missing dependency is detected from Fabric\'s own report', { timeout: 600000 }, async () => {
  const inst = instances.create({ name: 'GAME deps', version: '26.3', loader: 'fabric' });
  quiet(inst);
  await instances.installContent(inst.id, 'zoomify', 'mod', { module: 'zoomify' });
  const yacl = Object.values(instances.read(inst.id).content).find((e) => e.slug === 'yacl');
  fs.rmSync(path.join(instances.dirOf(inst.id), 'mods', yacl.file));
  const r = await run(inst);
  assert.equal(r.outcome, 'fabric-error');
  assert.ok(r.problem.ids.includes('yet_another_config_lib_v3'));
  const found = await doctor.resolve(inst.id, r.problem.ids);
  await doctor.fix(inst.id, { install: found.projects.map((p) => p.id) });
  const again = await run(inst);
  assert.equal(again.outcome, 'started', `the game starts after the one-click fix; Fabric said: ${again.problem ? again.problem.text.slice(0, 600) : '(nothing)'}`);
  await cleanup(inst);
});

test('running out of memory is detected', { timeout: 300000 }, async () => {
  const inst = instances.create({ name: 'GAME oom', version: '26.3', loader: 'fabric' });
  quiet(inst);
  const r = await run(inst, { ram: 64, ready: /^never matches$/ });
  assert.equal(r.outcome, 'out-of-memory');
  await cleanup(inst);
});

test('the game starts without any network access', { timeout: 600000 }, async () => {
  const inst = instances.create({ name: 'GAME offline', version: '26.3', loader: 'fabric' });
  quiet(inst);
  await hud.install(inst.id);
  await run(inst); // first start online: pins the loader build like a real first launch
  const real = global.fetch;
  global.fetch = () => Promise.reject(new TypeError('fetch failed (simulated offline)'));
  try {
    const r = await run(inst);
    assert.equal(r.outcome, 'started');
  } finally {
    global.fetch = real;
  }
  await cleanup(inst);
});
