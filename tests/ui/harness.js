// Tiny harness for UI tests. Each test file is an Electron main script (run by scripts/run-ui-tests.js):
//   const h = require('./harness');         // first: points the launcher at a throwaway data folder
//   h.run('what it checks', async ({ js, wait, check }) => { ... }, { setup(core) { ... } });
// Prints "PASS  name" / "FAIL  name" lines and exits non-zero if anything failed.
const fs = require('fs');
const os = require('os');
const path = require('path');

// The window stays far off screen and unfocused: tests must not cover what the developer is doing (a video, a game).
process.env.LUMEN_NO_WINDOW = '1';
process.env.LUMEN_SKIN_SERVICE = ''; // tests never talk to the real Lumen skin service
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-ui-'));
process.env.APPDATA = dir;
process.env.HOME = dir;
process.env.USERPROFILE = dir;
const root = path.join(__dirname, '..', '..');

const { app, BrowserWindow } = require('electron');
// Electron's own data folder (and the single-instance lock that lives in it) must not be shared with a launcher
// the developer happens to have open, or the launcher under test would quit at once.
app.setPath('userData', path.join(dir, 'electron'));
let fails = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== '' && extra !== undefined ? `  -> ${extra}` : ''}`);
};

// The launcher's own modules, loaded after the data folder was redirected.
const core = () => ({
  store: require(path.join(root, 'core', 'store')),
  instances: require(path.join(root, 'core', 'instances')),
  paths: require(path.join(root, 'core', 'paths')),
});

async function run(name, body, { setup, size = [1240, 800] } = {}) {
  console.log(`# ${name}`);
  let win;
  try {
    if (setup) await setup(core());
    require(path.join(root, 'main.js'));
    await app.whenReady();
    await wait(3000);
    win = BrowserWindow.getAllWindows()[0];
    win.webContents.setBackgroundThrottling(false);
    win.setSize(size[0], size[1]);
    const b = win.getBounds();
    check('the test window stays off screen and unfocused', b.x < -10000 && !win.isFocused(), JSON.stringify(b));
    const js = (code) => win.webContents.executeJavaScript(code);
    // Anything that throws in the page during the test is a failure of the test. The collector is installed again
    // whenever the page reloads (the language switch reloads it on purpose).
    const collect = "window.__errs=window.__errs||[];window.addEventListener('error',e=>__errs.push(e.message));window.addEventListener('unhandledrejection',e=>__errs.push('rej:'+(e.reason&&e.reason.message||e.reason)));0";
    await js(collect);
    win.webContents.on('dom-ready', () => { win.webContents.executeJavaScript(collect).catch(() => {}); });
    await body({ win, js, wait, check, core: core() });
    check('no uncaught errors in the page', (await js('__errs.length')) === 0, JSON.stringify(await js('__errs')));
  } catch (e) {
    check('the test itself did not crash', false, e && e.stack);
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  app.exit(fails ? 1 : 0);
}

module.exports = { run, check, wait, core, root, dir };
