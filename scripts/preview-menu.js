// Draws the in-game Lumen menu into PNG files without starting Minecraft or opening any window, and checks the clicks.
// Needs a JDK and the Gradle cache of the HUD build (run `npm run build:hud` once). Usage: node scripts/preview-menu.js [outDir]
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'lumen-menu-preview'));

// A jar from the Gradle cache (newest folder name wins).
function cached(group, name) {
  const base = path.join(os.homedir(), '.gradle', 'caches', 'modules-2', 'files-2.1', group, name);
  if (!fs.existsSync(base)) return null;
  const versions = fs.readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
  for (const v of versions) {
    for (const h of fs.readdirSync(path.join(base, v))) {
      for (const f of fs.readdirSync(path.join(base, v, h))) if (f.endsWith('.jar') && !f.includes('sources')) return path.join(base, v, h, f);
    }
  }
  return null;
}

function run() {
  const libs = [cached('com.google.code.gson', 'gson'), cached('org.slf4j', 'slf4j-api')];
  if (libs.some((l) => !l)) return { skipped: 'the Gradle cache has no gson / slf4j yet (run npm run build:hud once)' };
  const cp = libs.join(path.delimiter);
  const common = path.join(root, 'hud-mod', 'common', 'dev', 'lumen', 'hud');
  // The shared code that does not need Minecraft, plus stand-ins for the mod's entry point and for Fabric Loader.
  const skip = new Set(['DragProbe.java', 'LumenCommands.java']);
  const sources = fs.readdirSync(common).filter((f) => f.endsWith('.java') && !skip.has(f)).map((f) => path.join(common, f));
  const tools = path.join(root, 'hud-mod', 'tools', 'preview');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.java') ? [path.join(d, e.name)] : []));
  sources.push(...walk(tools));
  const classes = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-preview-classes-'));
  try {
    const javac = spawnSync('javac', ['-proc:none', '-nowarn', '-d', classes, '-cp', cp, ...sources], { encoding: 'utf8' });
    if (javac.error) return { skipped: 'javac was not found' };
    if (javac.status !== 0) return { error: javac.stderr || javac.stdout };
    // The preview gets its own config folder and skin library, and draws with the same typeface as the game.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-preview-data-'));
    const font = path.join(root, 'hud-mod', 'mc1.21', 'src', 'main', 'resources', 'assets', 'lumenhud', 'font', 'inter.ttf');
    try {
      const java = spawnSync('java', ['-Djava.awt.headless=true', `-Dlumen.config=${path.join(sandbox, 'config')}`, `-Dlumen.skins=${path.join(sandbox, 'skins')}`, `-Dlumen.font=${font}`,
        '-cp', `${classes}${path.delimiter}${cp}`, 'dev.lumen.hud.MenuPreview', outDir], { encoding: 'utf8' });
      return { status: java.status, out: `${java.stdout}${java.stderr}` };
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(classes, { recursive: true, force: true });
  }
}

module.exports = { run, outDir };
if (require.main === module) {
  const r = run();
  if (r.skipped) { console.log(`Skipped: ${r.skipped}`); process.exit(0); }
  if (r.error) { console.error(r.error); process.exit(1); }
  console.log(r.out);
  console.log(`Pictures in ${outDir}`);
  process.exit(r.status || 0);
}
