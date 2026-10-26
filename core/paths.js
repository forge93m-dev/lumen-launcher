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
    return fs.realpathSync.native(dir);
  } catch {
    return dir;
  }
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
