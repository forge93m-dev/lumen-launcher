// Builds every Lumen HUD variant and copies the jars into mods/ (the launcher installs them from there).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

// minecraft: version compiled against; suffix: jar name; range: fabric.mod.json dependency; compat: Compat layer
const TARGETS = [
  { dir: 'mc1.21', jar: 'lumenhud-1.0.0.jar', args: [] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.1.jar', args: ['-Pminecraft_version=26.1.2', '-Pfabric_version=0.155.3+26.1.2', '-Pjar_suffix=26.1', '-Pmc_range=~26.1', '-Pcompat=legacy'] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.2.jar', args: ['-Pminecraft_version=26.2', '-Pfabric_version=0.161.0+26.2', '-Pjar_suffix=26.2', '-Pmc_range=~26.2', '-Pcompat=new'] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.3.jar', args: ['-Pminecraft_version=26.3', '-Pfabric_version=0.165.0+26.3', '-Pjar_suffix=26.3', '-Pmc_range=~26.3', '-Pcompat=new'] },
];

fs.mkdirSync(path.join(root, 'mods'), { recursive: true });
for (const t of TARGETS) {
  const cwd = path.join(root, 'hud-mod', t.dir);
  console.log(`\n== ${t.jar}`);
  const r = spawnSync(gradlew, ['build', '--no-daemon', '-q', ...t.args], { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
  fs.copyFileSync(path.join(cwd, 'build', 'libs', t.jar), path.join(root, 'mods', t.jar));
}
console.log('\nAll jars copied to mods/');
