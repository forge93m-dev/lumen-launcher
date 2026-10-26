// Shared by the real-game tests: a throwaway local server, RCON commands, and hand-made PNG pictures.
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const paths = require('../../core/paths');
const { download } = require('../../core/net');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The tests start real games and a server on the developer's own computer, which may be busy with something else
// (another game, say). So they run with the least graphics and a lower priority than anything the person is doing.
// Children inherit the priority of this process on Windows; the explicit calls cover the other systems.
const os2 = require('os');
const LOW = os2.constants.priority.PRIORITY_BELOW_NORMAL;
try { os2.setPriority(0, LOW); } catch {}
const lowPriority = (proc) => { try { if (proc && proc.pid) os2.setPriority(proc.pid, LOW); } catch {} return proc; };

// options.txt lines that make Minecraft as cheap as it gets (names an older/newer version does not know are ignored)
const LOW_GRAPHICS = [
  'soundCategory_master:0.0', 'pauseOnLostFocus:false', 'onboardAccessibility:false', 'tutorialStep:none',
  'renderDistance:2', 'simulationDistance:5', 'graphicsMode:0', 'fancyGraphics:false', 'particles:2', 'entityShadows:false',
  'renderClouds:"false"', 'ao:false', 'bobView:false', 'maxFps:30', 'enableVsync:false', 'biomeBlendRadius:0', 'mipmapLevels:0',
  'entityDistanceScaling:0.5', 'fov:0.0',
].join('\n') + '\n';
// Java flags that keep a test game from using more of the CPU than it needs.
const LOW_JVM = '-XX:ActiveProcessorCount=2'; // the launcher already picks the garbage collector

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
  fs.writeFileSync(path.join(dir, 'server.properties'), 'online-mode=false\nserver-port=25599\nlevel-type=minecraft\:flat\nspawn-protection=0\nwhite-list=false\nenforce-whitelist=false\nspawn-monsters=false\nenable-rcon=true\nrcon.password=lumen\nrcon.port=25598\nview-distance=4\nsimulation-distance=4\n');
  const proc = spawn(javaExe, ['-Xmx512M', '-XX:+UseSerialGC', '-XX:ActiveProcessorCount=1', '-jar', 'server.jar', 'nogui'], { cwd: dir });
  lowPriority(proc);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 120000);
    proc.stdout.on('data', (d) => { if (/Done \(/.test(d.toString())) { clearTimeout(t); resolve(); } });
    proc.on('exit', () => { clearTimeout(t); reject(new Error('server exited early')); });
  });
  return proc;
}


module.exports = { sleep, rcon, startServer, makePng, lowPriority, LOW_GRAPHICS, LOW_JVM };
