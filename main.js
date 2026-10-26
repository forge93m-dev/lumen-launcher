const { app, BrowserWindow, ipcMain, shell, dialog, screen, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const paths = require('./core/paths');
const store = require('./core/store');
const game = require('./core/game');
const instances = require('./core/instances');
const mr = require('./core/modrinth');
const modules = require('./core/modules');
const hud = require('./core/hud');
const skins = require('./core/skins');
const cloud = require('./core/cloud');
const doctor = require('./core/doctor');
const packs = require('./core/packs');
const migrate = require('./core/migrate');
const active = require('./core/active');
const serverList = require('./core/servers');
const storage = require('./core/storage');
const { getJsonCached } = require('./core/net');

let win;
let running = null; // { proc, instId, started }

// Is at least a usable part of the saved window still on a connected screen? (A monitor may have been unplugged.)
const onScreen = (b) => screen.getAllDisplays().some((d) => {
  const w = d.workArea;
  return Math.min(b.x + b.width, w.x + w.width) - Math.max(b.x, w.x) > 120 && Math.min(b.y + b.height, w.y + w.height) - Math.max(b.y, w.y) > 80;
});

function createWindow() {
  const saved = store.load().window;
  const size = saved && saved.width >= 1000 && saved.height >= 640 ? { width: saved.width, height: saved.height } : { width: 1240, height: 760 };
  const pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && onScreen({ ...size, x: saved.x, y: saved.y }) ? { x: saved.x, y: saved.y } : {};
  win = new BrowserWindow({
    ...size,
    ...pos,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    backgroundColor: '#09090f',
    title: 'Lumen Client',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  if (saved && saved.maximized) win.maximize();
  // Remember where the user left the window.
  let boundsTimer;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win && !win.isDestroyed()) store.update({ window: { ...win.getNormalBounds(), maximized: win.isMaximized() } });
    }, 400);
  };
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) win.on(ev, saveBounds);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // LUMEN_NO_WINDOW=1 (the UI tests): the launcher runs and can be driven, but never appears on screen or takes focus.
  // It is shown far off screen without taking focus, because a hidden page stops running its animations.
  if (process.env.LUMEN_NO_WINDOW) {
    win.setPosition(-32000, -32000);
    win.once('ready-to-show', () => win.showInactive());
  } else {
    win.once('ready-to-show', () => win.show());
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

const send = (ch, ...a) => win && !win.isDestroyed() && win.webContents.send(ch, ...a);

function throttled(fn, ms = 120) {
  let last = 0;
  return (p) => {
    const now = Date.now();
    if (now - last > ms || (p.total && p.done === p.total)) {
      last = now;
      fn(p);
    }
  };
}

// Wraps handlers so errors reach the renderer as {error} instead of rejected promises with noisy prefixes.
function handle(ch, fn) {
  ipcMain.handle(ch, async (_e, ...args) => {
    try {
      return { ok: await fn(...args) };
    } catch (e) {
      console.error(ch, e);
      return { error: e.message || String(e) };
    }
  });
}

// ---- window ----
ipcMain.on('win', (_e, action) => {
  if (action === 'min') win.minimize();
  else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

// ---- config & accounts ----
handle('config:get', () => store.load());
handle('config:set', (patch) => store.update(patch));
handle('accounts:addOffline', (name) => store.addOfflineAccount(name));
handle('accounts:remove', (id) => store.removeAccount(id));
handle('sys:info', () => ({ totalMem: Math.floor(os.totalmem() / 1048576), root: paths.root, platform: process.platform, version: app.getVersion(), locale: app.getLocale() }));

// ---- versions ----
handle('versions:list', (snapshots) => game.listVersions(snapshots));
handle('versions:fabric', () => game.fabricGameVersions());

// ---- instances ----
handle('instances:list', () => instances.list());
handle('instances:create', (data) => instances.create(data));
handle('instances:update', (id, patch) => instances.update(id, patch));
handle('instances:duplicate', (id, name, worlds) => {
  if (running && running.instId === id) throw new Error('Close the game first so its files are not changing while they are copied');
  return instances.duplicate(id, name, { worlds: !!worlds });
});
handle('instances:remove', async (id) => {
  if (running && running.instId === id) throw new Error('Instance is running');
  await instances.remove(id);
});
handle('instances:open', (id, sub) => shell.openPath(path.join(instances.dirOf(id), sub || '')));

// ---- content ----
handle('content:list', (id) => ({ ...instances.listContent(id), active: active.get(id) }));
handle('content:use', (id, type, file, on) => {
  // The game rewrites options.txt when it exits, which would undo the change.
  if (running && running.instId === id) throw new Error('Close the game first, then switch packs');
  return active.use(id, type, file, !!on);
});
handle('content:install', (id, project, type, module) => {
  const onStatus = (t) => send('task:status', t);
  if (project === hud.ID) return hud.install(id, onStatus);
  return instances.installContent(id, project, type, { module, onStatus });
});
handle('content:remove', (id, projectId) => instances.removeContent(id, projectId));
handle('content:removeLocal', (id, type, file) => instances.removeLocalFile(id, type, file));
handle('content:addFiles', (id, files, hint) => instances.addFiles(id, files.filter((f) => typeof f === 'string'), hint));
handle('content:toggle', (id, projectId, enabled) => instances.toggleContent(id, projectId, enabled));
handle('content:toggleLocal', (id, type, file, enabled) => instances.toggleLocal(id, type, file, enabled));
handle('content:updates', (id) => instances.checkUpdates(id));

// ---- modrinth & modules ----
handle('modrinth:search', (params) => mr.search(params));
handle('modrinth:project', (id) => mr.getProject(id));
handle('modules:list', async () => {
  let projects = [];
  try { projects = await mr.getProjects(modules.map((m) => m.slug)); } catch {}
  const own = {
    slug: hud.ID, id: hud.ID, cat: 'HUD', name: 'Lumen HUD', builtin: true, preset: true, icon: 'img/lumenhud.png',
    desc: 'Our own HUD: FPS, CPS, ping, keystrokes, coordinates, armor, potion effects and more. Edit it in the HUD Editor.',
    gameVersions: hud.GAME_VERSIONS, loaders: ['fabric'],
  };
  return [own, ...modules.map((m) => {
    const p = projects.find((x) => x.slug === m.slug);
    return { ...m, id: p && p.id, icon: p && p.icon_url, gameVersions: p ? p.game_versions : null, loaders: p ? p.loaders : null, downloads: p && p.downloads };
  })];
});

// ---- Lumen HUD ----
handle('hud:info', () => ({ versions: hud.GAME_VERSIONS, matchers: hud.matchers, presets: hud.PRESETS, skins: hud.SKINS }));
handle('hud:get', (id) => hud.getConfig(id));
handle('hud:set', (id, cfg) => hud.setConfig(id, cfg));
handle('hud:reset', (id) => hud.resetConfig(id));

// ---- player skins (see core/skins.js)
const skinPayload = () => skins.list().map((s) => ({ ...s, png: `data:image/png;base64,${skins.read(s.id).toString('base64')}` }));
const skinChanged = () => { skins.syncAll(); cloud.pushQuietly(); return { skins: skinPayload(), cape: capePayload() }; };
const capePayload = () => (skins.hasCape() ? { has: true, png: `data:image/png;base64,${skins.capeBytes().toString('base64')}` } : { has: false });
handle('skins:list', () => ({ skins: skinPayload(), cape: capePayload() }));
handle('skins:pickCape', async () => {
  const r = await dialog.showOpenDialog(win, { title: L('Choose a cape', 'Выберите плащ'), filters: [{ name: L('Cape pictures', 'Картинки плащей'), extensions: ['png'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  skins.setCape(fs.readFileSync(r.filePaths[0]));
  skins.syncAll();
  cloud.pushQuietly();
  return { skins: skinPayload(), cape: capePayload() };
});
handle('skins:clearCape', () => { skins.clearCape(); skins.syncAll(); cloud.pushQuietly(); return { skins: skinPayload(), cape: capePayload() }; });
handle('skins:pickImport', async () => {
  const r = await dialog.showOpenDialog(win, { title: L('Choose a skin', 'Выберите скин'), filters: [{ name: L('Skin pictures', 'Картинки скинов'), extensions: ['png'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  skins.add(fs.readFileSync(r.filePaths[0]), { name: path.basename(r.filePaths[0], path.extname(r.filePaths[0])) });
  return skinChanged();
});
handle('skins:fromNickname', async (name) => { await skins.addFromNickname(name); return skinChanged(); });
handle('skins:use', (id) => { skins.setActive(id); return skinChanged(); });
handle('skins:update', (id, patch) => { skins.update(id, patch); return skinChanged(); });
handle('cloud:get', () => cloud.view());
handle('cloud:set', async (patch) => {
  const v = cloud.set(patch);
  if (v.active) await cloud.pushQuietly();
  return v;
});
handle('cloud:check', (url) => cloud.check(url));
handle('skins:remove', (id) => { skins.remove(id); return skinChanged(); });
// Picture behind the in-game menu. The game only reads PNG, so any picture is converted (and shrunk to 1920 wide).
const bgState = (id) => {
  const f = hud.menuBackgroundFile(id);
  if (!fs.existsSync(f)) return { has: false };
  const img = nativeImage.createFromPath(f);
  return { has: true, thumb: img.resize({ width: 320 }).toDataURL(), width: img.getSize().width, height: img.getSize().height };
};
handle('hud:bgState', (id) => { instances.read(id); return bgState(id); });
handle('hud:bgPick', async (id) => {
  instances.read(id);
  const r = await dialog.showOpenDialog(win, { title: L('Menu background', 'Фон меню'), filters: [{ name: L('Pictures', 'Картинки'), extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  let img = nativeImage.createFromPath(r.filePaths[0]);
  if (img.isEmpty()) throw new Error('This file is not a picture the launcher can read');
  if (img.getSize().width > 1920) img = img.resize({ width: 1920, quality: 'best' });
  require('./core/fsutil').writeFileAtomic(hud.menuBackgroundFile(id), img.toPNG());
  return bgState(id);
});
handle('hud:bgClear', (id) => { instances.read(id); fs.rmSync(hud.menuBackgroundFile(id), { force: true }); return { has: false }; });
handle('hud:icons', () => hud.previewIcons());

// ---- news, servers, screenshots ----
handle('news:get', async () => {
  const data = await getJsonCached('https://launchercontent.mojang.com/v2/javaPatchNotes.json', 60 * 60 * 1000);
  return data.entries.slice(0, 12).map((e) => ({
    title: e.title, version: e.version, type: e.type, date: e.date, text: e.shortText,
    image: e.image && e.image.url ? new URL(e.image.url, 'https://launchercontent.mojang.com/').href : null,
  }));
});
handle('server:status', (address) => getJsonCached(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`, 60 * 1000));
handle('screenshots:list', (id) => instances.listScreenshots(id));
// Screenshot actions only ever touch .png files inside an instance's screenshots folder.
function screenshotPath(p) {
  const resolved = path.resolve(String(p));
  const root = path.resolve(paths.instances) + path.sep;
  if (!resolved.startsWith(root) || !/[\\/]screenshots[\\/][^\\/]+\.png$/i.test(resolved)) throw new Error('Not a screenshot');
  return resolved;
}
// Electron's clipboard no longer has writeImage; images go through the web clipboard API in the page,
// so the page needs the file's bytes (read here, where the path can be validated).
handle('screenshots:read', (p) => fs.promises.readFile(screenshotPath(p)));
handle('screenshots:delete', (p) => shell.trashItem(screenshotPath(p))); // recycle bin, so a misclick is recoverable
handle('shell:show', (p) => shell.showItemInFolder(p));
handle('shell:openData', () => shell.openPath(paths.root));
handle('storage:usage', () => storage.usage());
handle('storage:clean', () => {
  if (running) throw new Error('Close the game first'); // a running game has its version files open
  return storage.clean();
});
handle('shell:external', (url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

// ---- game ----
handle('game:state', () => (running ? { state: 'running', instId: running.instId, started: running.started } : { state: 'idle' }));

handle('game:launch', async (instId, server) => {
  if (running) throw new Error('A game is already running');
  const cfg = store.load();
  const account = cfg.accounts.find((a) => a.id === cfg.selectedAccount);
  if (!account) throw new Error('Add an account in Settings first');
  const inst = instances.read(instId);

  running = { proc: null, instId, started: null };
  send('game:state', { state: 'preparing', instId });
  try {
    await hud.sync(instId);
    try { skins.sync(instId); cloud.sync(instId); } catch {} // skins are a nicety, they must never stop the game from starting
    cloud.pushQuietly(); // keeps your skin on the service up to date; the game does not wait for it
    try { serverList.sync(instId, cfg.servers || []); } catch {} // a broken servers.dat must never stop the game from starting
    const ctx = await game.prepare(inst, throttled((p) => send('game:progress', p)));
    // Mods may have been installed while assets were downloading: merge into a fresh copy, never overwrite.
    await instances.patch(instId, (i) => {
      i.lastPlayed = Date.now();
      if (inst.loaderVersion && i.version === inst.version && i.loader === inst.loader) i.loaderVersion = inst.loaderVersion;
    });
    send('game:progress', { text: 'Starting Minecraft…' });
    const gameDir = instances.dirOf(inst.id);
    send('game:log', `[Lumen] Launching ${inst.name} (${inst.version} ${inst.loader}${inst.loaderVersion ? ` ${inst.loaderVersion}` : ''}) as ${account.name}`, 'info');
    // Fabric stops on a missing/incompatible mod and then sits behind a modal dialog forever: report it
    // to the UI (which can offer a fix) and close the stuck process.
    const watch = doctor.createWatcher((problem) => {
      if (!running) return;
      running.problem = true;
      send('game:problem', { instId, kind: 'mods', ...problem });
      setTimeout(() => running && running.proc && running.proc.kill(), 1500);
    }, () => {
      // Out of memory: the game may limp on or die; either way tell the user how much it had.
      if (running) running.problem = true;
      send('game:problem', { instId, kind: 'oom', ram: inst.ram || cfg.settings.ram || 4096, systemRam: Math.floor(os.totalmem() / 1048576) });
    });
    const proc = game.launch(ctx, { inst, gameDir, account, settings: cfg.settings, server }, {
      onLog: (line, level) => { watch(line); send('game:log', line, level); },
      onExit: (code) => {
        const secs = running && running.started ? Math.round((Date.now() - running.started) / 1000) : 0;
        const wasProblem = running && running.problem;
        const userStopped = running && running.killed;
        const startedAt = running && running.started;
        instances.patch(instId, (i) => { i.playtime = (i.playtime || 0) + secs; }).catch(() => {});
        running = null;
        send('game:log', `[Lumen] Game exited with code ${code}`, code === 0 && !wasProblem ? 'info' : 'err');
        // A real crash (not a mod problem we already reported, not the user pressing Stop) leaves a report behind.
        if (code !== 0 && !wasProblem && !userStopped && startedAt) {
          const report = doctor.findCrashReport(instId, startedAt);
          if (report) send('game:crash', { instId, ...report });
        }
        send('game:state', { state: 'idle', instId, code });
        if (win && !win.isDestroyed() && !win.isVisible() && !process.env.LUMEN_NO_WINDOW) win.show();
      },
    });
    running.proc = proc;
    running.started = Date.now();
    send('game:state', { state: 'running', instId, started: running.started });
    if (cfg.settings.closeOnLaunch) setTimeout(() => running && win.hide(), 4000);
  } catch (e) {
    running = null;
    send('game:state', { state: 'idle', instId, error: e.message });
    throw e;
  }
});

handle('game:kill', () => {
  if (running && running.proc) { running.killed = true; running.proc.kill(); }
});

// ---- changing the Minecraft version of an instance ----
handle('instances:migratePlan', (id, version) => migrate.plan(id, version));
handle('instances:migrate', (id, version) => {
  if (running && running.instId === id) throw new Error('Close the game first');
  return migrate.apply(id, version, { onStatus: (t) => send('task:status', t) });
});

// ---- modpacks ----
const packStatus = throttled((t) => send('task:status', t.text), 150);
const asStatus = (text) => packStatus({ text, done: 0, total: 0 });
// Native file dialogs are drawn by the OS, so their few texts are translated here rather than in the page.
const isRu = () => { const l = (store.load().settings || {}).language; return l === 'ru' || (l !== 'en' && /^(ru|uk|be)/i.test(app.getLocale())); };
const L = (en, ru) => (isRu() ? ru : en);
const mrpackFilter = () => [{ name: L('Modrinth modpack', 'Модпак Modrinth'), extensions: ['mrpack'] }];
// Picking a file and doing the work are separate calls so the UI only shows a progress card for the work.
handle('pack:pickImport', async () => {
  const r = await dialog.showOpenDialog(win, { title: L('Import modpack', 'Импорт модпака'), filters: mrpackFilter(), properties: ['openFile'] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});
handle('pack:import', (file) => {
  if (!/\.mrpack$/i.test(String(file))) throw new Error('Choose a .mrpack file');
  return packs.importMrpack(file, { onStatus: asStatus });
});
handle('pack:install', (projectId) => packs.installFromModrinth(projectId, { onStatus: asStatus }));
handle('pack:pickExport', async (id) => {
  const safeName = instances.read(id).name.replace(/[<>:"/\\|?*]+/g, '_');
  const r = await dialog.showSaveDialog(win, { title: L('Export modpack', 'Экспорт модпака'), defaultPath: `${safeName}.mrpack`, filters: mrpackFilter() });
  return r.canceled || !r.filePath ? null : r.filePath;
});
handle('pack:export', async (id, file) => {
  if (!/\.mrpack$/i.test(String(file))) throw new Error('Export files must end in .mrpack');
  const res = await packs.exportMrpack(id, file, { onStatus: asStatus });
  shell.showItemInFolder(file);
  return { file, ...res };
});

// ---- launch doctor ----
handle('doctor:preflight', (id) => doctor.preflight(id));
handle('doctor:resolve', (id, modIds) => doctor.resolve(id, modIds));
handle('doctor:fix', (id, plan) => doctor.fix(id, plan));
handle('doctor:openFile', (file) => {
  // Only crash reports inside an instance folder may be opened.
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve(paths.instances) + path.sep) || !/crash-reports/.test(resolved)) throw new Error('Not a crash report');
  return shell.openPath(resolved);
});

// Two launchers sharing one data folder would overwrite each other's config and instances.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(() => {
    fs.mkdirSync(paths.instances, { recursive: true });
    createWindow();
  });
}
// An error nobody caught (a failed download inside a callback, say) would otherwise take the launcher down with
// a system crash dialog. Keep running, write it to launcher.log for bug reports, and tell the user.
const LOG_FILE = path.join(paths.root, 'launcher.log');
function logError(kind, err) {
  const text = `[${new Date().toISOString()}] ${kind}: ${(err && err.stack) || err}\n`;
  console.error(text);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1024 * 1024) fs.renameSync(LOG_FILE, `${LOG_FILE}.old`); // keep it bounded
    fs.appendFileSync(LOG_FILE, text);
  } catch {}
  send('app:error', (err && err.message) || String(err));
}
process.on('uncaughtException', (e) => logError('uncaughtException', e));
process.on('unhandledRejection', (e) => logError('unhandledRejection', e));
handle('app:logPath', () => LOG_FILE);
handle('app:openLog', () => (fs.existsSync(LOG_FILE) ? shell.showItemInFolder(LOG_FILE) : false));
app.on('render-process-gone', (_e, wc, details) => {
  logError('render-process-gone', new Error(details.reason));
  if (details.reason !== 'clean-exit' && win && !win.isDestroyed()) win.reload(); // the page crashed: bring it back
});
app.on('window-all-closed', () => app.quit());
