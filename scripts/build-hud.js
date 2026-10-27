// Builds every Lumen HUD variant and copies the jars into mods/ (the launcher installs them from there).
const { spawnSync } = require('child_process');
// Builds and tests are heavy: run them below normal priority (children inherit it) so a game being played is not disturbed.
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'; // cmd.exe needs the ".\" to run a script in the current folder

// minecraft: version compiled against; suffix: jar name; range: fabric.mod.json dependency; compat: Compat layer
const TARGETS = [
  { dir: 'mc1.21', jar: 'lumenhud-1.0.0.jar', args: [] },
  // 1.21.x differs in three places that each changed at a different version (see hud-mod/mc1.21/compat/):
  //   items (1.21.2), matrix (1.21.6), keys + input (1.21.9)
  { dir: 'mc1.21', jar: 'lumenhud-1.0.0+1.21.4.jar', args: ['-Pminecraft_version=1.21.4', '-Pyarn_mappings=1.21.4+build.8', '-Pfabric_version=0.119.4+1.21.4', '-Pjar_suffix=+1.21.4', '-Pmc_range=~1.21.4', '-Pcompat_items=new', '-Pcompat_tex=mid'] },
  { dir: 'mc1.21', jar: 'lumenhud-1.0.0+1.21.8.jar', args: ['-Pminecraft_version=1.21.8', '-Pyarn_mappings=1.21.8+build.1', '-Pfabric_version=0.136.1+1.21.8', '-Pjar_suffix=+1.21.8', '-Pmc_range=~1.21.8', '-Pcompat_items=new', '-Pcompat_matrix=new', '-Pcompat_tex=new'] },
  { dir: 'mc1.21', jar: 'lumenhud-1.0.0+1.21.11.jar', args: ['-Pminecraft_version=1.21.11', '-Pyarn_mappings=1.21.11+build.6', '-Pfabric_version=0.141.6+1.21.11', '-Pjar_suffix=+1.21.11', '-Pmc_range=~1.21.11', '-Pcompat_items=new', '-Pcompat_matrix=new', '-Pcompat_keys=new', '-Pcompat_input=new', '-Pcompat_tex=new', '-Pcompat_skin=new', '-Pcompat_font=new'] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.1.jar', args: ['-Pminecraft_version=26.1.2', '-Pfabric_version=0.155.3+26.1.2', '-Pjar_suffix=26.1', '-Pmc_range=~26.1', '-Pcompat=legacy'] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.2.jar', args: ['-Pminecraft_version=26.2', '-Pfabric_version=0.161.0+26.2', '-Pjar_suffix=26.2', '-Pmc_range=~26.2', '-Pcompat=new'] },
  { dir: 'mc26', jar: 'lumenhud-1.0.0+26.3.jar', args: ['-Pminecraft_version=26.3', '-Pfabric_version=0.165.0+26.3', '-Pjar_suffix=26.3', '-Pmc_range=~26.3', '-Pcompat=new'] },
];

fs.mkdirSync(path.join(root, 'mods'), { recursive: true });
for (const t of TARGETS) {
  const cwd = path.join(root, 'hud-mod', t.dir);
  console.log(`\n== ${t.jar}`);
  const r = spawnSync(gradlew, ['build', '--no-daemon', '-q', '--max-workers=2', ...t.args], { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
  fs.copyFileSync(path.join(cwd, 'build', 'libs', t.jar), path.join(root, 'mods', t.jar));
}
console.log('\nAll jars copied to mods/');
