// Vanilla + Fabric installation and launching.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');
const paths = require('./paths');
const { getJsonCached, download, downloadMany } = require('./net');
const { ensureJava } = require('./java');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC = 'https://meta.fabricmc.net/v2';
const OS = { win32: 'windows', darwin: 'osx', linux: 'linux' }[process.platform];
const NATIVE_TAG = OS === 'osx' ? (process.arch === 'arm64' ? 'natives-macos-arm64' : 'natives-macos') : `natives-${OS}`;

// ---------- version metadata ----------

async function getManifest() {
  return getJsonCached(MANIFEST);
}

// Releases from 1.8 onwards (older versions need legacy asset handling).
async function listVersions(includeSnapshots) {
  const m = await getManifest();
  return m.versions
    .filter((v) => v.releaseTime >= '2014-09-02' && (v.type === 'release' || (includeSnapshots && v.type === 'snapshot')))
    .map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }));
}

async function readJson(file) {
  return JSON.parse(await fsp.readFile(file, 'utf8'));
}

async function getVersionJson(id) {
  const file = path.join(paths.versions, id, `${id}.json`);
  try { return await readJson(file); } catch {}
  const m = await getManifest();
  const v = m.versions.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown Minecraft version ${id}`);
  await download(v.url, file, { sha1: v.sha1 });
  return readJson(file);
}

async function fabricGameVersions() {
  const list = await getJsonCached(`${FABRIC}/versions/game`);
  return list.map((g) => g.version);
}

async function latestFabricLoader(game) {
  const list = await getJsonCached(`${FABRIC}/versions/loader/${encodeURIComponent(game)}`);
  if (!list.length) throw new Error(`Fabric does not support Minecraft ${game}`);
  return (list.find((l) => l.loader.stable) || list[0]).loader.version;
}

async function getFabricProfile(game, loader) {
  const id = `fabric-loader-${loader}-${game}`;
  const file = path.join(paths.versions, id, `${id}.json`);
  try { return await readJson(file); } catch {}
  await download(`${FABRIC}/versions/loader/${encodeURIComponent(game)}/${encodeURIComponent(loader)}/profile/json`, file);
  return readJson(file);
}

function mergeProfile(v, f) {
  return {
    ...v,
    id: f.id,
    mainClass: f.mainClass,
    libraries: [...(f.libraries || []), ...(v.libraries || [])],
    arguments: v.arguments
      ? {
          game: [...(v.arguments.game || []), ...((f.arguments && f.arguments.game) || [])],
          jvm: [...((f.arguments && f.arguments.jvm) || []), ...(v.arguments.jvm || [])],
        }
      : undefined,
  };
}

// ---------- rules & libraries ----------

function rulesAllow(rules, features = {}) {
  if (!rules || !rules.length) return true;
  let allow = false;
  for (const r of rules) {
    let match = true;
    if (r.os) {
      if (r.os.name && r.os.name !== OS) match = false;
      if (r.os.arch === 'x86' && process.arch !== 'ia32') match = false;
    }
    if (r.features) {
      for (const [k, val] of Object.entries(r.features)) if (!!features[k] !== val) match = false;
    }
    if (match) allow = r.action === 'allow';
  }
  return allow;
}

function mavenPath(name) {
  const [g, a, v, c] = name.split('@')[0].split(':');
  return `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${c ? `-${c}` : ''}.jar`;
}

function libKey(name) {
  const [g, a, , c] = name.split(':');
  return `${g}:${a}${c ? `:${c}` : ''}`;
}

function resolveLibraries(profile) {
  const out = [];
  const seen = new Set();
  for (const lib of profile.libraries || []) {
    if (!rulesAllow(lib.rules)) continue;
    const key = libKey(lib.name);
    if (seen.has(key)) continue;
    seen.add(key);

    const d = lib.downloads;
    if (d && d.artifact) {
      const a = d.artifact;
      out.push({ path: a.path || mavenPath(lib.name), url: a.url, sha1: a.sha1, size: a.size, cp: true, extract: lib.name.endsWith(`:${NATIVE_TAG}`) });
    } else if (!lib.natives) {
      const p = mavenPath(lib.name);
      const base = (lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/');
      out.push({ path: p, url: base + p, sha1: lib.sha1, size: lib.size, cp: true });
    }
    if (lib.natives && lib.natives[OS]) {
      const cls = lib.natives[OS].replace('${arch}', process.arch === 'ia32' ? '32' : '64');
      const a = d && d.classifiers && d.classifiers[cls];
      if (a) out.push({ path: a.path, url: a.url, sha1: a.sha1, size: a.size, cp: false, extract: true, exclude: lib.extract && lib.extract.exclude });
    }
  }
  return out;
}

function extractNatives(libs, dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const l of libs.filter((x) => x.extract)) {
    const zip = new AdmZip(path.join(paths.libraries, l.path));
    for (const e of zip.getEntries()) {
      const n = e.entryName;
      if (e.isDirectory || n.startsWith('META-INF')) continue;
      if (l.exclude && l.exclude.some((x) => n.startsWith(x))) continue;
      if (!/\.(dll|so|dylib|jnilib)$/i.test(n)) continue;
      const dest = path.join(dir, path.basename(n));
      if (!fs.existsSync(dest)) fs.writeFileSync(dest, e.getData());
    }
  }
}

// ---------- install ----------

async function installAssets(v, onProgress) {
  const ai = v.assetIndex;
  const idxFile = path.join(paths.assets, 'indexes', `${ai.id}.json`);
  await download(ai.url, idxFile, { sha1: ai.sha1, size: ai.size });
  const idx = await readJson(idxFile);
  const jobs = Object.values(idx.objects).map((o) => {
    const p = `${o.hash.slice(0, 2)}/${o.hash}`;
    return { url: `https://resources.download.minecraft.net/${p}`, dest: path.join(paths.assets, 'objects', p), sha1: o.hash, size: o.size };
  });
  await downloadMany(jobs, 'Downloading assets', onProgress, 32);
}

// Makes sure everything the instance needs is on disk. Returns launch context.
async function prepare(inst, onProgress) {
  onProgress({ text: `Fetching Minecraft ${inst.version}` });
  const v = await getVersionJson(inst.version);
  let profile = v;
  if (inst.loader === 'fabric') {
    if (!inst.loaderVersion) inst.loaderVersion = await latestFabricLoader(inst.version);
    onProgress({ text: `Fetching Fabric ${inst.loaderVersion}` });
    profile = mergeProfile(v, await getFabricProfile(inst.version, inst.loaderVersion));
  }

  const java = await ensureJava((v.javaVersion && v.javaVersion.component) || 'jre-legacy', onProgress);

  const libs = resolveLibraries(profile);
  const c = v.downloads.client;
  const jobs = [
    { url: c.url, dest: path.join(paths.versions, v.id, `${v.id}.jar`), sha1: c.sha1, size: c.size },
    ...libs.filter((l) => l.url).map((l) => ({ url: l.url, dest: path.join(paths.libraries, l.path), sha1: l.sha1, size: l.size })),
  ];
  await downloadMany(jobs, 'Downloading libraries', onProgress);

  const nativesDir = path.join(paths.versions, v.id, 'natives');
  extractNatives(libs, nativesDir);

  await installAssets(v, onProgress);
  return { v, profile, libs, java, nativesDir };
}

// ---------- launch ----------

function buildArgs(ctx, { inst, gameDir, account, settings, server }) {
  const { v, profile, libs, nativesDir } = ctx;
  const sep = path.delimiter;
  const cp = [
    ...libs.filter((l) => l.cp).map((l) => path.join(paths.libraries, l.path)),
    path.join(paths.versions, v.id, `${v.id}.jar`),
  ].join(sep);

  const width = String(inst.width || settings.width || 1280);
  const height = String(inst.height || settings.height || 720);
  const vars = {
    auth_player_name: account.name,
    version_name: profile.id,
    game_directory: gameDir,
    assets_root: paths.assets,
    game_assets: paths.assets,
    assets_index_name: v.assetIndex.id,
    auth_uuid: account.uuid.replace(/-/g, ''),
    auth_access_token: account.accessToken || '0',
    auth_session: account.accessToken || '0',
    clientid: '0',
    auth_xuid: '0',
    user_type: account.type === 'msa' ? 'msa' : 'legacy',
    user_properties: '{}',
    version_type: 'Lumen',
    natives_directory: nativesDir,
    launcher_name: 'lumen-client',
    launcher_version: '1.0.0',
    classpath: cp,
    classpath_separator: sep,
    library_directory: paths.libraries,
    resolution_width: width,
    resolution_height: height,
    quickPlayMultiplayer: server || '',
    quickPlayPath: path.join(gameDir, 'quickPlay', 'log.json'),
  };
  const features = { has_custom_resolution: true, is_quick_play_multiplayer: !!server };
  const sub = (s) => s.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const flat = (arr) => {
    const out = [];
    for (const a of arr || []) {
      if (typeof a === 'string') out.push(a);
      else if (rulesAllow(a.rules, features)) out.push(...[].concat(a.value));
    }
    return out;
  };

  let jvm;
  let game;
  if (profile.arguments) {
    jvm = flat(profile.arguments.jvm);
    game = flat(profile.arguments.game);
  } else {
    jvm = ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'];
    game = profile.minecraftArguments.split(' ');
    game.push('--width', width, '--height', height);
  }
  if (settings.fullscreen) game.push('--fullscreen');
  if (server && !game.includes('--quickPlayMultiplayer')) {
    const [host, port] = server.split(':');
    game.push('--server', host, '--port', port || '25565');
  }

  const ram = inst.ram || settings.ram || 4096;
  const extra = `${settings.jvmArgs || ''} ${inst.jvmArgs || ''}`.trim().split(/\s+/).filter(Boolean);
  return [
    `-Xmx${ram}M`,
    `-Xms${Math.min(ram, 1024)}M`,
    '-XX:+UseG1GC',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:G1NewSizePercent=20',
    '-XX:MaxGCPauseMillis=50',
    ...extra,
    ...jvm.map(sub),
    profile.mainClass,
    ...game.map(sub),
  ];
}

function launch(ctx, opts, { onLog, onExit }) {
  const args = buildArgs(ctx, opts);
  const java = opts.settings.javaPath || ctx.java;
  fs.mkdirSync(opts.gameDir, { recursive: true });
  const proc = spawn(java, args, { cwd: opts.gameDir, windowsHide: false });
  const pipe = (stream, level) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) if (l) onLog(l, level);
    });
  };
  pipe(proc.stdout, 'out');
  pipe(proc.stderr, 'err');
  proc.on('error', (e) => onLog(`Failed to start Java: ${e.message}`, 'err'));
  proc.on('exit', (code) => onExit(code));
  return proc;
}

module.exports = { listVersions, fabricGameVersions, latestFabricLoader, prepare, launch, buildArgs };
