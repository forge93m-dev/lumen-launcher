// Joins a local test server with Lumen HUD installed and lets the mod take its own screenshots (the in-game HUD and
// the layout editor). Checks the mod loads without errors; set LUMEN_SHOTS=<folder> to keep the pictures and look at them.
// Versions: LUMEN_TEST_VERSIONS=1.21.4,1.21.8 (default 26.3); LUMEN_HUD_JAR=<file> tries another build on them.
// Slow; needs a display. `npm run test:game`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
process.env.LUMEN_HOME = path.join(os.tmpdir(), 'lumen-game-test-cache');
const game = require('../../core/game');
const instances = require('../../core/instances');
const hud = require('../../core/hud');
const paths = require('../../core/paths');
const { download } = require('../../core/net');

const VERSIONS = (process.env.LUMEN_TEST_VERSIONS || '26.3').split(',');
// LUMEN_REAL_MOUSE=1: instead of the replayed events, drag with the real OS cursor (it takes over the mouse for a few seconds).
const REAL_MOUSE = process.env.LUMEN_REAL_MOUSE === '1';
const { sleep, rcon, startServer, makePng, lowPriority, LOW_GRAPHICS, LOW_JVM } = require('./lib');

for (const version of VERSIONS) {
  test(`${version}: Lumen HUD draws in a real world and its editor opens`, { timeout: 900000 }, async () => {
    const inst = instances.create({ name: `VISUAL ${version}`, version, loader: 'fabric' });
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'options.txt'), LOW_GRAPHICS);
    if (process.env.LUMEN_HUD_JAR) {
      // Try a build on a version the launcher does not list yet, to find out which versions one jar really covers.
      await instances.installContent(inst.id, 'fabric-api', 'mod');
      const dir = path.join(instances.dirOf(inst.id), 'mods');
      fs.copyFileSync(process.env.LUMEN_HUD_JAR, path.join(dir, path.basename(process.env.LUMEN_HUD_JAR)));
    } else {
      await hud.install(inst.id);
    }
    fs.mkdirSync(path.join(instances.dirOf(inst.id), 'config'), { recursive: true });
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'config', 'lumen-menu-bg.png'), makePng(480, 270));
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'config', 'lumen-skin.png'), makePng(64, 64));
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'config', 'lumen-cape.png'), makePng(64, 32));
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'config', 'lumen-skin.json'), JSON.stringify({ enabled: true, slim: true, cape: true }));
    const i2 = instances.read(inst.id);
    const ctx = await game.prepare(i2, () => {});
    await instances.patch(inst.id, (x) => { x.loaderVersion = i2.loaderVersion; });
    const server = await startServer(version, ctx.java.replace('javaw.exe', 'java.exe'));
    const lines = [];
    let started = false;
    let dragged = false;
    try {
      await new Promise((resolve) => {
        const timer = setTimeout(() => { proc.kill(); resolve(); }, 240000);
        const proc = lowPriority(game.launch(ctx, { inst: i2, gameDir: instances.dirOf(inst.id), account: { name: 'LumenTest', uuid: '11111111-1111-3111-8111-111111111111' },
          settings: { ram: 2048, width: 1280, height: 720, jvmArgs: `${LOW_JVM} ${REAL_MOUSE ? '-Dlumenhud.selftest=true -Dlumenhud.hold=true' : '-Dlumenhud.selftest=true'}` }, server: 'localhost:25599' }, {
          onLog: async (l) => {
            lines.push(l);
            const m = REAL_MOUSE && !dragged && /selftest: hold fps (\d+),(\d+),(\d+),(\d+) scale=([\d.]+) editor=true/.exec(l);
            if (m) {
              dragged = true;
              await sleep(1500);
              try { lines.push(`real mouse: ${execFileSync('powershell', ['-NoProfile', '-File', path.join(__dirname, 'real-mouse.ps1'), m[1], m[2], m[3], m[4], m[5]], { timeout: 30000, encoding: 'utf8' }).trim()}`); } catch (e) { lines.push(`real mouse failed: ${e.message}`); }
              await sleep(2500);
              setTimeout(() => proc.kill(), 100);
            }
            if (!started && /Loaded \d+ advancements|Loaded \d+ recipes|Lumen HUD ready/.test(l) && /Loaded \d+ advancements/.test(l)) {
              started = true;
              await sleep(2000);
              await rcon(['whitelist off', 'clear LumenTest', 'execute at LumenTest run summon zombie ~ ~ ~2 {NoAI:1b,Silent:1b,Invulnerable:1b,PersistenceRequired:1b}', 'effect give LumenTest speed 300 1', 'effect give LumenTest night_vision 90 0', 'effect give LumenTest regeneration 25 2',
                'give LumenTest totem_of_undying 2', 'give LumenTest golden_apple 5', 'give LumenTest ender_pearl 16', 'item replace entity LumenTest armor.head with diamond_helmet[damage=1500]', 'item replace entity LumenTest armor.chest with iron_chestplate',
                'item replace entity LumenTest weapon.mainhand with netherite_sword', 'time set day']);
            }
          },
          onExit: () => { clearTimeout(timer); resolve(); },
        }));
      });
    } finally {
      server.kill();
    }
    const bad = lines.filter((l) => /Mixin apply.*failed|InvalidInjection|Incompatible mod|NoSuchMethodError|NoSuchFieldError|NoClassDefFoundError|Could not execute entrypoint|Lumen HUD.*(Exception|error)/i.test(l));
    assert.deepEqual(bad, [], 'the mod must load cleanly');
    assert.ok(lines.some((l) => /Lumen HUD ready/.test(l)), 'Lumen HUD should report that it is ready');
    if (REAL_MOUSE) {
      const holds = lines.filter((l) => /selftest: hold fps/.test(l)).map((l) => /fps (\d+),(\d+)/.exec(l).slice(1, 3).join(','));
      assert.ok(new Set(holds).size > 1, `the real mouse drag must move the element; ${lines.filter((l) => /real mouse|selftest: (click|dragged)/.test(l)).slice(-60).join(' // ')}`);
      return;
    }
    // Client features: toggle sprint, fullbright and zoom change the game's own options and give them back.
    const feat = (re) => lines.find((l) => re.test(l)) || '';
    assert.match(feat(/selftest: sprint=/), /sprint=true gamma=16\.0/, 'toggle sprint and fullbright must take effect');
    assert.match(feat(/selftest: zoom fov=/), /fov=30(?!\d)/, 'zoom must narrow the field of view');
    const restored = /restored fov=(\d+) gamma=([\d.]+)/.exec(feat(/selftest: restored/));
    assert.ok(restored && +restored[1] > 30 && +restored[2] < 5, `fov and gamma must be given back: ${feat(/selftest: restored/)}`);
    assert.match(feat(/selftest: death message=/), /message=You died at 10 64 -21 \(Nether\) last=10 64 -21 \(Nether\)/, 'the death tracker must remember where you died');
    assert.match(feat(/selftest: freelook/), /player=unchanged cam=15\.0/, 'freelook must turn the camera and leave the player alone');
    assert.match(feat(/selftest: sneak toggle/), /sneak toggle true true false/, 'toggle sneak must flip on every press');
    assert.match(feat(/selftest: skin /), /lumenhud[:/]player_skin\S* (SLIM|slim) cape=\S*lumenhud[:/]player_cape/i, 'your own player must wear the skin and cape from the launcher');
    // The self-test drags the FPS element in the editor with replayed GLFW mouse events.
    const drag = lines.find((l) => /selftest: drag/.test(l));
    assert.ok(drag && /drag OK/.test(drag), `dragging an element in the editor must work: ${drag || 'no drag result in the log'}`);
    const shots = path.join(instances.dirOf(inst.id), 'screenshots');
    const files = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')) : [];
    assert.equal(files.length, 6, `the self-test should have taken six screenshots (skin, HUD, layout editor, menu with a picture, menu with a gradient, cosmetics); log tail:\n${lines.slice(-8).join('\n')}`);
    if (process.env.LUMEN_SHOTS) {
      fs.mkdirSync(process.env.LUMEN_SHOTS, { recursive: true });
      files.sort().forEach((f, i) => fs.copyFileSync(path.join(shots, f), path.join(process.env.LUMEN_SHOTS, `${version}-${['skin', 'hud', 'editor', 'menu', 'menu2', 'cosmetics'][i]}.png`)));
    }
    await sleep(2500);
    await instances.remove(inst.id);
  });
}
