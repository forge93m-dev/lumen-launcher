const fs = require('fs');
const path = require('path');
const os = require('os');

const base = process.platform === 'win32'
  ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : os.homedir();

// Packaged Windows apps (MSIX) get %APPDATA% silently redirected. Resolve to the real folder so the
// classpath we pass matches the paths Java reports; otherwise Fabric Loader misclassifies its own jars.
function realDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const real = fs.realpathSync.native(dir);
    return process.platform === 'win32' ? redirected(real) : real;
  } catch {
    return dir;
  }
}

// realpath does not always show the redirect (it does not on newer Windows builds). Find out by writing a marker file:
// if it shows up under %LOCALAPPDATA%\Packages\<app>\LocalCache\Roaming\..., that is where Java will see the folder.
function redirected(dir) {
  const roaming = process.env.APPDATA;
  const local = process.env.LOCALAPPDATA;
  if (!roaming || !local) return dir;
  const rel = path.relative(roaming, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return dir;
  const marker = path.join(dir, `.where-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(marker, '');
    const packages = path.join(local, 'Packages');
    for (const app of fs.readdirSync(packages)) {
      const candidate = path.join(packages, app, 'LocalCache', 'Roaming', rel);
      if (fs.existsSync(path.join(candidate, path.basename(marker)))) return candidate;
    }
  } catch {
    // no Packages folder, or no write access: the folder is where it says it is
  } finally {
    try { fs.unlinkSync(marker); } catch {}
  }
  return dir;
}

// LUMEN_HOME moves the whole data folder (portable installs, or a shared download cache for tests).
const root = realDir(process.env.LUMEN_HOME || path.join(base, process.platform === 'linux' ? '.lumen' : 'LumenClient'));

module.exports = {
  root,
  config: path.join(root, 'config.json'),
  libraries: path.join(root, 'libraries'),
  assets: path.join(root, 'assets'),
  versions: path.join(root, 'versions'),
  runtimes: path.join(root, 'runtimes'),
  instances: path.join(root, 'instances'),
};
