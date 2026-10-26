// Two real game clients on one local server, and a real Lumen skin service: the second player's skin and cape travel
// through the service and show up on the first client. Set LUMEN_SHOTS=<folder> to keep the pictures (see them!).
// Versions: LUMEN_TEST_VERSIONS=26.3,1.21.8 (default). Slow; needs a display. `npm run test:game`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.LUMEN_HOME = path.join(os.tmpdir(), 'lumen-game-test-cache');
const game = require('../../core/game');
const instances = require('../../core/instances');
const hud = require('../../core/hud');
const { createService } = require('../../server/skin-service');
const { sleep, rcon, startServer, makePng, lowPriority, LOW_GRAPHICS, LOW_JVM } = require('./lib');

const VERSIONS = (process.env.LUMEN_TEST_VERSIONS || '26.3,1.21.8').split(',');
const OPTIONS = LOW_GRAPHICS;

async function makeInstance(name, version, cloudUrl) {
  const inst = instances.create({ name, version, loader: 'fabric' });
  fs.writeFileSync(path.join(instances.dirOf(inst.id), 'options.txt'), OPTIONS);
  await hud.install(inst.id);
  const cfg = path.join(instances.dirOf(inst.id), 'config');
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, 'lumen-cloud.json'), JSON.stringify({ enabled: true, url: cloudUrl }));
  const i2 = instances.read(inst.id);
  const ctx = await game.prepare(i2, () => {});
  await instances.patch(inst.id, (x) => { x.loaderVersion = i2.loaderVersion; });
  return { inst, i2, ctx };
}

for (const version of VERSIONS) {
  test(`${version}: another Lumen player's skin and cape arrive through the skin service`, { timeout: 1200000 }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-skins-'));
    const service = createService({ data: dataDir, writesPerMin: 1000 });
    await new Promise((r) => service.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${service.address().port}`;
    // The second player has a slim skin and a cape on the service.
    const put = await fetch(`${url}/v1/profile/LumenTest2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 't'.repeat(32), slim: true, skin: makePng(64, 64).toString('base64'), cape: makePng(64, 32).toString('base64') }),
    });
    assert.equal(put.status, 200);

    const a = await makeInstance(`CLOUD A ${version}`, version, url);
    const b = await makeInstance(`CLOUD B ${version}`, version, url);
    const server = await startServer(version, a.ctx.java.replace('javaw.exe', 'java.exe'));
    let serverOut = '';
    server.stdout.on('data', (d) => { serverOut += d.toString(); });
    const joined = async (name, ms) => { for (let t = 0; t < ms; t += 500) { if (serverOut.includes(`${name} joined the game`)) return true; await sleep(500); } return false; };
    const linesA = [];
    const linesB = [];
    let procB;
    let procA;
    try {
      // player B joins first and just stands there
      procB = lowPriority(game.launch(b.ctx, { inst: b.i2, gameDir: instances.dirOf(b.inst.id), account: { name: 'LumenTest2', uuid: '22222222-2222-3222-8222-222222222222' },
        settings: { ram: 2048, width: 640, height: 360, jvmArgs: LOW_JVM }, server: 'localhost:25599' }, { onLog: (l) => linesB.push(l), onExit: () => {} }));
      const NL = String.fromCharCode(10);
      assert.ok(await joined('LumenTest2', 240000), `the second player should join the server; its log tail:${NL}${linesB.slice(-15).join(NL)}${NL}server:${NL}${serverOut.split(NL).slice(-6).join(NL)}`);
      await rcon(['whitelist off', 'time set day']);

      let placed = false;
      await new Promise((resolve) => {
        const timer = setTimeout(() => { procA.kill(); resolve(); }, 240000);
        procA = lowPriority(game.launch(a.ctx, { inst: a.i2, gameDir: instances.dirOf(a.inst.id), account: { name: 'LumenTest', uuid: '11111111-1111-3111-8111-111111111111' },
          settings: { ram: 2048, width: 1280, height: 720, jvmArgs: `${LOW_JVM} -Dlumenhud.selftest=true` }, server: 'localhost:25599' }, {
          onLog: async (l) => {
            linesA.push(l);
            // Client A walks a little during its self-test; once it has stopped, B goes next to it, turned away from the camera
            // so that its back (and cape) show.
            if (!placed && /selftest: zoom fov=/.test(l)) {
              placed = true;
              await rcon(['execute at LumenTest run tp LumenTest2 ~-2 ~ ~3 0 0']);
            }
          },
          onExit: () => { clearTimeout(timer); resolve(); },
        }));
      });
      console.log(linesA.filter((l) => /selftest: remote/.test(l)).join(String.fromCharCode(10)));
      const remote = linesA.filter((l) => /selftest: remote LumenTest2/.test(l));
      assert.ok(remote.length > 0, `client A should have seen the second player; log tail:\n${linesA.slice(-8).join('\n')}`);
      assert.ok(remote.some((l) => /remote\/lumentest2_skin\S* (SLIM|slim) cape=\S*remote\/lumentest2_cape/i.test(l)),
        `the second player must wear the skin and cape from the service:\n${remote.join('\n')}`);
      const shots = path.join(instances.dirOf(a.inst.id), 'screenshots');
      const files = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')).sort() : [];
      if (process.env.LUMEN_SHOTS && files.length) {
        fs.mkdirSync(process.env.LUMEN_SHOTS, { recursive: true });
        fs.copyFileSync(path.join(shots, files[0]), path.join(process.env.LUMEN_SHOTS, `cloud-${version}.png`));
      }
    } finally {
      try { procA && procA.kill(); } catch {}
      try { procB && procB.kill(); } catch {}
      server.kill();
      service.close();
      await sleep(2500);
      for (const x of [a, b]) { try { await instances.remove(x.inst.id); } catch {} }
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
}
