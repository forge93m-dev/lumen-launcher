const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sandbox, offline, put } = require('../helpers');
sandbox();
offline();
const instances = require('../../core/instances');
const doctor = require('../../core/doctor');
const game = require('../../core/game');
const hud = require('../../core/hud');

// ---------- launch doctor ----------

const REPORT = `[main/ERROR]: Incompatible mods found!
net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the game or each other!
A potential solution has been determined, this may resolve your problem:
\t - Install yet_another_config_lib_v3, any version.
\t - Install fabric-language-kotlin, version 1.13 or later.
\t - Replace mod 'oldmod' (oldmod) with a newer version.
More details:
\t - Mod 'Zoomify' (zoomify) 2.17.0+mc26.3 requires any version of yet_another_config_lib_v3, which is missing!
\t - Mod 'Zoomify' (zoomify) 2.17.0+mc26.3 requires version 1.13 or later of fabric-language-kotlin, which is missing!`;

test('doctor: Fabric\'s report is parsed into missing mods, other advice and details', () => {
  const p = doctor.parseFabricError(REPORT);
  assert.deepEqual(p.ids, ['yet_another_config_lib_v3', 'fabric-language-kotlin']);
  assert.equal(p.other.length, 1);
  assert.match(p.other[0], /Replace/);
  assert.equal(p.details.length, 2);
});

test('doctor: the watcher reports a Fabric failure once, after the whole report has printed', async () => {
  const seen = [];
  const watch = doctor.createWatcher((p) => seen.push(p));
  for (const line of REPORT.split('\n')) watch(line);
  assert.equal(seen.length, 0, 'must wait for the rest of the report');
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].ids, ['yet_another_config_lib_v3', 'fabric-language-kotlin']);
});

test('doctor: out-of-memory is reported once even though the game prints it repeatedly', () => {
  let n = 0;
  const watch = doctor.createWatcher(() => {}, () => { n++; });
  for (let i = 0; i < 5; i++) watch('java.lang.OutOfMemoryError: Java heap space');
  watch('There is insufficient memory for the Java Runtime Environment to continue.');
  assert.equal(n, 1);
});

test('doctor: finds the newest crash report written since the game started', () => {
  const inst = instances.create({ name: 'C', version: '26.3', loader: 'fabric' });
  const dir = path.join(instances.dirOf(inst.id), 'crash-reports');
  put(path.join(dir, 'old.txt'));
  fs.utimesSync(path.join(dir, 'old.txt'), new Date(Date.now() - 3600e3), new Date(Date.now() - 3600e3));
  assert.equal(doctor.findCrashReport(inst.id, Date.now() - 1000), null, 'an old report is not this crash');
  fs.writeFileSync(path.join(dir, 'crash-1.txt'), '---- Minecraft Crash Report ----\nTime: now\nDescription: Rendering overlay\n');
  const r = doctor.findCrashReport(inst.id, Date.now() - 5000);
  assert.equal(r.name, 'crash-1.txt');
  assert.equal(r.description, 'Rendering overlay');
});

test('doctor: preflight finds deleted jars and does not touch vanilla instances', async () => {
  const inst = instances.create({ name: 'P', version: '26.3', loader: 'fabric' });
  await instances.patch(inst.id, (i) => { i.content.a = { id: 'a', slug: 'a', title: 'A', type: 'mod', file: 'a.jar', enabled: true, needs: [] }; });
  const pf = await doctor.preflight(inst.id);
  assert.deepEqual(pf.missingFiles.map((f) => f.title), ['A']);
  const van = instances.create({ name: 'V', version: '26.3', loader: 'vanilla' });
  assert.deepEqual(await doctor.preflight(van.id), { missingFiles: [], missingDeps: [], uncertain: false });
});

// ---------- launch arguments ----------

const ctx = (extra = {}) => ({
  v: { id: '1.21.1', assetIndex: { id: '17' } },
  profile: {
    id: 'fabric-loader-0.20.1-1.21.1', mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    arguments: {
      jvm: ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'],
      game: ['--username', '${auth_player_name}', { rules: [{ action: 'allow', features: { has_custom_resolution: true } }], value: ['--width', '${resolution_width}', '--height', '${resolution_height}'] }],
    },
    ...extra,
  },
  libs: [{ path: 'a/b.jar', cp: true }, { path: 'native.jar', cp: false }], nativesDir: 'N',
});
const account = { name: 'Steve', uuid: '11111111-1111-3111-8111-111111111111' };
const args = (opts = {}, c = ctx()) => game.buildArgs(c, { inst: { id: 'i', ...(opts.inst || {}) }, gameDir: 'G', account, settings: { ram: 4096, ...(opts.settings || {}) }, server: opts.server });

test('args: memory comes from settings, an instance override wins, main class and game arguments follow', () => {
  const a = args();
  assert.ok(a.includes('-Xmx4096M'));
  assert.ok(args({ inst: { ram: 6144 } }).includes('-Xmx6144M'));
  assert.ok(a.indexOf('net.fabricmc.loader.impl.launch.knot.KnotClient') > a.indexOf('-cp'));
  const g = a.slice(a.indexOf('net.fabricmc.loader.impl.launch.knot.KnotClient') + 1);
  assert.deepEqual(g.slice(0, 2), ['--username', 'Steve']);
  assert.ok(g.includes('--width') && g.includes('1280'));
});

test('args: only libraries meant for the classpath are on it, plus the game jar', () => {
  const cp = args()[args().indexOf('-cp') + 1];
  assert.ok(cp.includes('b.jar') && !cp.includes('native.jar') && cp.includes('1.21.1.jar'));
});

test('args: fullscreen and quick-join are added only when asked for', () => {
  assert.ok(!args().includes('--fullscreen'));
  assert.ok(args({ settings: { fullscreen: true } }).includes('--fullscreen'));
  const joined = args({ server: 'play.example.net:25570' });
  const i = joined.indexOf('--server');
  assert.deepEqual(joined.slice(i, i + 4), ['--server', 'play.example.net', '--port', '25570']);
  const dflt = args({ server: 'play.example.net' });
  assert.equal(dflt[dflt.indexOf('--port') + 1], '25565');
});

test('args: very old versions (minecraftArguments string) still get the window size', () => {
  const old = ctx();
  delete old.profile.arguments;
  old.profile.minecraftArguments = '--username ${auth_player_name} --version ${version_name}';
  const a = args({}, old);
  assert.ok(a.includes('-Djava.library.path=N') && a.includes('--width') && a.includes('Steve'));
});

// ---------- Lumen HUD ----------

test('hud: which versions get which build', () => {
  for (const v of ['1.21', '1.21.1', '1.21.4', '1.21.8', '1.21.11', '26.1', '26.1.2', '26.2', '26.3', '26.3.1']) assert.equal(hud.supports({ loader: 'fabric', version: v }), true, v);
  for (const v of ['1.20.4', '1.21.2', '1.21.5', '1.21.9', '26.4', '1.8.9']) assert.equal(hud.supports({ loader: 'fabric', version: v }), false, v);
  assert.equal(hud.supports({ loader: 'vanilla', version: '26.3' }), false);
});

test('hud: config defaults, round trip, and an old-format file is replaced by defaults', () => {
  const inst = instances.create({ name: 'H', version: '26.3', loader: 'fabric' });
  assert.deepEqual(hud.getConfig(inst.id), hud.defaults());
  const cfg = hud.getConfig(inst.id);
  cfg.accentColor = '#10B981'; cfg.elements.fps.scale = 2;
  hud.setConfig(inst.id, cfg);
  assert.equal(hud.getConfig(inst.id).accentColor, '#10B981');
  assert.equal(hud.getConfig(inst.id).elements.fps.scale, 2);
  const file = path.join(instances.dirOf(inst.id), 'config', 'lumenhud.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, textColor: '#000000', elements: { fps: { x: 0.5 } } }));
  assert.deepEqual(hud.getConfig(inst.id), hud.defaults());
  fs.writeFileSync(file, '{ broken json');
  assert.deepEqual(hud.getConfig(inst.id), hud.defaults(), 'a corrupt config must not break the editor');
});

test('hud: the launcher\'s default layout is the same as the mod\'s (HudConfig.java)', () => {
  const java = fs.readFileSync(path.join(__dirname, '..', '..', 'hud-mod', 'common', 'dev', 'lumen', 'hud', 'HudConfig.java'), 'utf8');
  const ids = /IDS = \{([^}]*)\}/.exec(java)[1].split(',').map((x) => x.trim().replace(/"/g, ''));
  const fromJava = {};
  for (const m of java.matchAll(/case "(\w+)" -> new Element\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\);/g)) fromJava[m[1]] = { enabled: true, ax: +m[2], ay: +m[3], x: +m[4], y: +m[5] };
  for (const m of java.matchAll(/case "(\w+)" -> \{\s*Element e = new Element\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\);\s*e\.enabled = false;/g)) fromJava[m[1]] = { enabled: false, ax: +m[2], ay: +m[3], x: +m[4], y: +m[5] };
  for (const m of java.matchAll(/case "(\w+)" -> disabled\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\);/g)) fromJava[m[1]] = { enabled: false, ax: +m[2], ay: +m[3], x: +m[4], y: +m[5] };
  const js = hud.defaults().elements;
  assert.deepEqual(Object.keys(js), ids, 'same elements in the same order');
  for (const id of ids) {
    const { enabled, ax, ay, x, y } = js[id];
    assert.deepEqual({ enabled, ax, ay, x, y }, fromJava[id], `default of "${id}"`);
  }
});

test('hud: the launcher\'s presets are the mod\'s presets (Presets.java)', () => {
  const java = fs.readFileSync(path.join(__dirname, '..', '..', 'hud-mod', 'common', 'dev', 'lumen', 'hud', 'Presets.java'), 'utf8');
  const names = /NAMES = \{([^}]*)\}/.exec(java)[1].split(',').map((x) => x.trim().replace(/"/g, ''));
  assert.deepEqual(Object.keys(hud.PRESETS), names, 'same presets in the same order');
  const body = java.slice(java.indexOf('switch (index)'));
  const cases = [...body.matchAll(/(?:case (\d) ->|default ->) \{\s*on = set\(([^)]*)\);\s*cfg\.theme = "(\w+)";/g)];
  assert.equal(cases.length, names.length);
  const byIndex = {};
  for (const m of cases) byIndex[m[1] === undefined ? 0 : +m[1]] = { on: m[2].split(',').map((x) => x.trim().replace(/"/g, '')), theme: m[3] };
  names.forEach((n, i) => {
    assert.equal(hud.PRESETS[n].theme, byIndex[i].theme, `${n}: theme`);
    assert.deepEqual([...hud.PRESETS[n].on].sort(), [...byIndex[i].on].sort(), `${n}: elements`);
  });
});

test('hud: the launcher\'s menu skins are the mod\'s skins (Skin.java)', () => {
  const java = fs.readFileSync(path.join(__dirname, '..', '..', 'hud-mod', 'common', 'dev', 'lumen', 'hud', 'Skin.java'), 'utf8');
  const names = /NAMES = \{([^}]*)\}/.exec(java)[1].split(',').map((x) => x.trim().replace(/"/g, ''));
  assert.deepEqual(Object.keys(hud.SKINS), names, 'same skins in the same order');
  const rows = [...java.matchAll(/new Skin\(0x[0-9A-F]{2}([0-9A-F]{6}), 0x[0-9A-F]{2}([0-9A-F]{6}), 0x[0-9A-F]{2}([0-9A-F]{6}), 0x[0-9A-F]{2}([0-9A-F]{6}),/gi)];
  assert.equal(rows.length, names.length);
  names.forEach((n, i) => {
    const want = { panel: `#${rows[i][1]}`, edge: `#${rows[i][2]}`, text: `#${rows[i][3]}`, dim: `#${rows[i][4]}` };
    assert.deepEqual(hud.SKINS[n], want, n);
  });
  assert.equal(hud.defaults().menuSkin, 'midnight');
});
