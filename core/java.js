// Downloads the exact Java runtime Mojang ships for each Minecraft version.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const paths = require('./paths');
const { getJsonCached, downloadMany } = require('./net');

const ALL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

function platformKey() {
  const arm = process.arch === 'arm64';
  if (process.platform === 'win32') return arm ? 'windows-arm64' : process.arch === 'ia32' ? 'windows-x86' : 'windows-x64';
  if (process.platform === 'darwin') return arm ? 'mac-os-arm64' : 'mac-os';
  return process.arch === 'ia32' ? 'linux-i386' : 'linux';
}

function javaExe(dir) {
  if (process.platform === 'win32') return path.join(dir, 'bin', 'javaw.exe');
  if (process.platform === 'darwin') return path.join(dir, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  return path.join(dir, 'bin', 'java');
}

async function ensureJava(component, onProgress) {
  const dir = path.join(paths.runtimes, component);
  const marker = path.join(dir, '.lumen-complete');
  if (fs.existsSync(marker)) return javaExe(dir);

  const all = await getJsonCached(ALL);
  const plat = platformKey();
  const entry = (all[plat] && all[plat][component] && all[plat][component][0])
    || (plat === 'windows-arm64' && all['windows-x64'][component] && all['windows-x64'][component][0]);
  if (!entry) throw new Error(`No Java runtime "${component}" for ${plat}`);

  const manifest = await getJsonCached(entry.manifest.url);
  const files = Object.entries(manifest.files);
  for (const [name, f] of files) if (f.type === 'directory') await fsp.mkdir(path.join(dir, name), { recursive: true });

  const jobs = files
    .filter(([, f]) => f.type === 'file')
    .map(([name, f]) => ({ url: f.downloads.raw.url, dest: path.join(dir, name), sha1: f.downloads.raw.sha1, size: f.downloads.raw.size, exec: f.executable }));
  await downloadMany(jobs, `Downloading Java (${component})`, onProgress, 24);

  if (process.platform !== 'win32') {
    for (const j of jobs) if (j.exec) await fsp.chmod(j.dest, 0o755);
    for (const [name, f] of files) {
      if (f.type === 'link') {
        try { await fsp.symlink(f.target, path.join(dir, name)); } catch {}
      }
    }
  }
  await fsp.writeFile(marker, new Date().toISOString());
  return javaExe(dir);
}

module.exports = { ensureJava };
