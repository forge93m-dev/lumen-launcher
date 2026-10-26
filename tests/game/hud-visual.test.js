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
const { spawn } = require('child_process');
process.env.LUMEN_HOME = path.join(os.tmpdir(), 'lumen-game-test-cache');
const game = require('../../core/game');
const instances = require('../../core/instances');
const hud = require('../../core/hud');
const paths = require('../../core/paths');
const { download } = require('../../core/net');

const VERSIONS = (process.env.LUMEN_TEST_VERSIONS || '26.3').split(',');
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
    const i2 = instances.read(inst.id);
    const ctx = await game.prepare(i2, () => {});
    await instances.patch(inst.id, (x) => { x.loaderVersion = i2.loaderVersion; });
    const server = await startServer(version, ctx.java.replace('javaw.exe', 'java.exe'));
    const lines = [];
    let started = false;
    try {
      await new Promise((resolve) => {
        const timer = setTimeout(() => { proc.kill(); resolve(); }, 240000);
        const proc = game.launch(ctx, { inst: i2, gameDir: instances.dirOf(inst.id), account: { name: 'LumenTest', uuid: '11111111-1111-3111-8111-111111111111' },
          settings: { ram: 3072, width: 1280, height: 720, jvmArgs: '-Dlumenhud.selftest=true' }, server: 'localhost:25599' }, {
          onLog: async (l) => {
            lines.push(l);
            if (!started && /Loaded \d+ advancements|Loaded \d+ recipes|Lumen HUD ready/.test(l) && /Loaded \d+ advancements/.test(l)) {
              started = true;
              await sleep(2000);
              await rcon(['whitelist off', 'clear LumenTest', 'execute at LumenTest run summon zombie ~ ~ ~2 {NoAI:1b,Silent:1b,Invulnerable:1b,PersistenceRequired:1b}', 'effect give LumenTest speed 300 1', 'effect give LumenTest night_vision 90 0', 'effect give LumenTest regeneration 25 2',
                'item replace entity LumenTest armor.head with diamond_helmet[damage=300]', 'item replace entity LumenTest armor.chest with iron_chestplate',
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
    const shots = path.join(instances.dirOf(inst.id), 'screenshots');
    const files = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')) : [];
    assert.equal(files.length, 2, `the self-test should have taken two screenshots (HUD, editor); log tail:\n${lines.slice(-8).join('\n')}`);
    if (process.env.LUMEN_SHOTS) {
      fs.mkdirSync(process.env.LUMEN_SHOTS, { recursive: true });
      files.sort().forEach((f, i) => fs.copyFileSync(path.join(shots, f), path.join(process.env.LUMEN_SHOTS, `${version}-${i === 0 ? 'hud' : 'editor'}.png`)));
    }
    await sleep(2500);
    await instances.remove(inst.id);
  });
}
