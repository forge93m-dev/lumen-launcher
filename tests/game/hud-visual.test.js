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

// A small picture to put behind the menu (PNG written by hand, no image library needed).
function makePng(w, h) {
  const zlib = require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const ring = Math.abs(Math.hypot(x - w * 0.7, y - h * 0.4) - h * 0.28) < 6;
      raw[o] = ring ? 255 : 30 + (x * 120) / w;
      raw[o + 1] = ring ? 200 : 20 + (y * 140) / h;
      raw[o + 2] = ring ? 80 : 160 - (x * 60) / w;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(t)); return Buffer.concat([len, t, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const VERSIONS = (process.env.LUMEN_TEST_VERSIONS || '26.3').split(',');
// LUMEN_REAL_MOUSE=1: instead of the replayed events, drag with the real OS cursor (it takes over the mouse for a few seconds).
const REAL_MOUSE = process.env.LUMEN_REAL_MOUSE === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rcon(commands) {
  return new Promise((resolve) => {
    const s = net.connect(25598, '127.0.0.1');
    let id = 1;
    const packet = (type, body) => {
      const b = Buffer.from(body, 'utf8');
      const buf = Buffer.alloc(14 + b.length);
      buf.writeInt32LE(10 + b.length, 0); buf.writeInt32LE(id++, 4); buf.writeInt32LE(type, 8); b.copy(buf, 12);
      return buf;
    };
    s.on('connect', async () => {
      s.write(packet(3, 'lumen'));
      for (const c of commands) { await sleep(250); s.write(packet(2, c)); }
      setTimeout(() => { s.end(); resolve(); }, 500);
    });
    s.on('error', () => resolve());
  });
}

async function startServer(version, javaExe) {
  const v = JSON.parse(fs.readFileSync(path.join(paths.versions, version, `${version}.json`), 'utf8'));
  const dir = path.join(os.tmpdir(), 'lumen-test-server', version);
  fs.mkdirSync(dir, { recursive: true });
  await download(v.downloads.server.url, path.join(dir, 'server.jar'), { sha1: v.downloads.server.sha1 });
  fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
  fs.writeFileSync(path.join(dir, 'server.properties'), 'online-mode=false\nserver-port=25599\nlevel-type=minecraft\:flat\nspawn-protection=0\nwhite-list=false\nenforce-whitelist=false\nspawn-monsters=false\nenable-rcon=true\nrcon.password=lumen\nrcon.port=25598\nview-distance=6\n');
  const proc = spawn(javaExe, ['-Xmx1G', '-jar', 'server.jar', 'nogui'], { cwd: dir });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 120000);
    proc.stdout.on('data', (d) => { if (/Done \(/.test(d.toString())) { clearTimeout(t); resolve(); } });
    proc.on('exit', () => { clearTimeout(t); reject(new Error('server exited early')); });
  });
  return proc;
}

for (const version of VERSIONS) {
  test(`${version}: Lumen HUD draws in a real world and its editor opens`, { timeout: 900000 }, async () => {
    const inst = instances.create({ name: `VISUAL ${version}`, version, loader: 'fabric' });
    fs.writeFileSync(path.join(instances.dirOf(inst.id), 'options.txt'), 'soundCategory_master:0.0\npauseOnLostFocus:false\nonboardAccessibility:false\ntutorialStep:none\n');
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
        const proc = game.launch(ctx, { inst: i2, gameDir: instances.dirOf(inst.id), account: { name: 'LumenTest', uuid: '11111111-1111-3111-8111-111111111111' },
          settings: { ram: 3072, width: 1280, height: 720, jvmArgs: REAL_MOUSE ? '-Dlumenhud.selftest=true -Dlumenhud.hold=true' : '-Dlumenhud.selftest=true' }, server: 'localhost:25599' }, {
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
        });
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
    // The self-test drags the FPS element in the editor with replayed GLFW mouse events.
    const drag = lines.find((l) => /selftest: drag/.test(l));
    assert.ok(drag && /drag OK/.test(drag), `dragging an element in the editor must work: ${drag || 'no drag result in the log'}`);
    const shots = path.join(instances.dirOf(inst.id), 'screenshots');
    const files = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')) : [];
    assert.equal(files.length, 4, `the self-test should have taken four screenshots (HUD, layout editor, menu with a picture, menu with a gradient); log tail:\n${lines.slice(-8).join('\n')}`);
    if (process.env.LUMEN_SHOTS) {
      fs.mkdirSync(process.env.LUMEN_SHOTS, { recursive: true });
      files.sort().forEach((f, i) => fs.copyFileSync(path.join(shots, f), path.join(process.env.LUMEN_SHOTS, `${version}-${['hud', 'editor', 'menu', 'menu2'][i]}.png`)));
    }
    await sleep(2500);
    await instances.remove(inst.id);
  });
}
