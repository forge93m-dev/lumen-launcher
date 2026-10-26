// Lumen HUD: our own Fabric mod, bundled with the launcher (built from hud-mod/).
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const paths = require('./paths');
const instances = require('./instances');
const { writeFileAtomic } = require('./fsutil');

const ID = 'lumen-hud';
const VERSION = '1.0.0';
// Installed builds ship the jars next to the app (<resources>/mods); a development checkout keeps them in ./mods.
const packagedMods = process.resourcesPath && path.join(process.resourcesPath, 'mods');
const MODS = packagedMods && fs.existsSync(packagedMods) ? packagedMods : path.join(__dirname, '..', 'mods');
// One build per Minecraft API generation (sources in hud-mod/mc1.21 and hud-mod/mc26).
const BUILDS = [
  { re: /^1\.21(\.1)?$/, file: `lumenhud-${VERSION}.jar` },
  { re: /^1\.21\.4$/, file: `lumenhud-${VERSION}+1.21.4.jar` },
  { re: /^1\.21\.8$/, file: `lumenhud-${VERSION}+1.21.8.jar` },
  { re: /^1\.21\.11$/, file: `lumenhud-${VERSION}+1.21.11.jar` },
  { re: /^26\.1(\.\d+)?$/, file: `lumenhud-${VERSION}+26.1.jar` },
  { re: /^26\.2(\.\d+)?$/, file: `lumenhud-${VERSION}+26.2.jar` },
  { re: /^26\.3(\.\d+)?$/, file: `lumenhud-${VERSION}+26.3.jar` },
];
// For the UI (the single place that knows which versions have a build).
const GAME_VERSIONS = ['1.21', '1.21.1', '1.21.4', '1.21.8', '1.21.11', '26.1', '26.2', '26.3'];
const matchers = BUILDS.map((b) => b.re.source);

const buildFor = (version) => BUILDS.find((b) => b.re.test(version));

// Mirrors HudConfig.java defaults.
function defaults() {
  return {
    version: 2,
    textColor: '#FFFFFF',
    accentColor: '#8B5CF6',
    background: true,
    bgOpacity: 0.45,
    shadow: true,
    hideInDebug: true,
    coordsFacing: true,
    coordsBiome: true,
    keystrokesCps: true,
    keystrokesSpace: true,
    armorDurability: true,
    armorHeldItem: true,
    clock24: true,
    memoryShowMax: true,
    itemsTotems: true,
    itemsGapples: true,
    itemsPearls: true,
    itemsCrystals: true,
    toggleSprint: false,
    fullbright: false,
    zoom: true,
    zoomFov: 30,
    smoothZoom: true,
    freelook: true,
    toggleSneak: false,
    deathChat: true,
    durabilityPercent: 10,
    theme: 'glass',
    menuSkin: 'midnight',
    menuBackground: 'dim',
    menuDim: 0.55,
    elements: {
      fps: { enabled: true, ax: 0, ay: 0, x: 2, y: 2, scale: 1 },
      cps: { enabled: true, ax: 0, ay: 0, x: 2, y: 19, scale: 1 },
      coords: { enabled: true, ax: 0, ay: 0, x: 2, y: 36, scale: 1 },
      keystrokes: { enabled: true, ax: 1, ay: 1, x: 2, y: 2, scale: 1 },
      armor: { enabled: true, ax: 1, ay: 1, x: 76, y: 2, scale: 1 },
      ping: { enabled: true, ax: 0, ay: 0, x: 2, y: 74, scale: 1 },
      speed: { enabled: false, ax: 0, ay: 0, x: 2, y: 91, scale: 1 },
      clock: { enabled: true, ax: 1, ay: 0, x: 2, y: 2, scale: 1 },
      effects: { enabled: true, ax: 0, ay: 0, x: 2, y: 110, scale: 1 },
      reach: { enabled: false, ax: 1, ay: 0, x: 2, y: 19, scale: 1 },
      combo: { enabled: false, ax: 1, ay: 0, x: 2, y: 36, scale: 1 },
      memory: { enabled: false, ax: 1, ay: 0, x: 2, y: 148, scale: 1 },
      session: { enabled: false, ax: 1, ay: 0, x: 2, y: 130, scale: 1 },
      items: { enabled: true, ax: 1, ay: 0, x: 2, y: 53, scale: 1 },
      target: { enabled: true, ax: 0.5, ay: 0, x: 0, y: 28, scale: 1 },
      server: { enabled: false, ax: 0, ay: 1, x: 2, y: 60, scale: 1 },
      sprint: { enabled: true, ax: 0, ay: 1, x: 2, y: 40, scale: 1 },
      death: { enabled: true, ax: 0.5, ay: 0, x: 0, y: 52, scale: 1 },
      alert: { enabled: true, ax: 0.5, ay: 0, x: 0, y: 70, scale: 1 },
      compass: { enabled: true, ax: 0.5, ay: 0, x: 0, y: 2, scale: 1 },
    },
  };
}

// Mirrors Presets.java: which elements are on, and the theme.
const PRESETS = {
  Default: { theme: 'glass', on: ['fps', 'cps', 'coords', 'keystrokes', 'armor', 'ping', 'effects', 'clock', 'items', 'target', 'sprint', 'death', 'alert', 'compass'] },
  PvP: { theme: 'flat', on: ['fps', 'cps', 'ping', 'keystrokes', 'armor', 'items', 'reach', 'combo', 'target', 'alert', 'effects'] },
  Survival: { theme: 'glass', on: ['fps', 'coords', 'compass', 'clock', 'armor', 'effects', 'death', 'alert', 'target'] },
  Clean: { theme: 'minimal', on: ['fps', 'coords'] },
};

// Mirrors Skin.java: colours of the in-game menu (the first four of each skin).
const SKINS = {
  midnight: { panel: '#101018', edge: '#2B2B3D', text: '#EDEDF5', dim: '#8A8AA3' },
  graphite: { panel: '#161616', edge: '#343434', text: '#EEEEEE', dim: '#9A9A9A' },
  ocean: { panel: '#0B1622', edge: '#1D3B55', text: '#E6F3FF', dim: '#7FA3C0' },
  rose: { panel: '#190F16', edge: '#4A2340', text: '#FFEAF5', dim: '#B58AA8' },
  forest: { panel: '#0E1A14', edge: '#254634', text: '#E9FFF1', dim: '#80B08F' },
  light: { panel: '#F4F4F8', edge: '#CFCFD9', text: '#1B1B26', dim: '#6B6B80' },
};

const configFile = (instId) => path.join(instances.dirOf(instId), 'config', 'lumenhud.json');

function supports(inst) {
  return inst.loader === 'fabric' && !!buildFor(inst.version);
}

function getConfig(instId) {
  const d = defaults();
  try {
    const c = JSON.parse(fs.readFileSync(configFile(instId), 'utf8'));
    if (c.version >= 2) return { ...d, ...c, elements: { ...d.elements, ...(c.elements || {}) } };
  } catch {}
  return d;
}

function setConfig(instId, cfg) {
  const f = configFile(instId);
  writeFileAtomic(f, JSON.stringify({ ...cfg, version: 2 }, null, 2));
  return cfg;
}

// The picture behind the in-game menu: a PNG next to the HUD config, which the mod reads.
const menuBackgroundFile = (instId) => path.join(instances.dirOf(instId), 'config', 'lumen-menu-bg.png');

function resetConfig(instId) {
  return setConfig(instId, defaults());
}

// Puts the build matching the instance's version in mods/ and removes builds for other versions.
// Returns the jar name, or null when the version is unsupported.
function copyJar(inst) {
  const build = buildFor(inst.version);
  const dir = path.join(instances.dirOf(inst.id), 'mods');
  const e = inst.content[ID];
  for (const b of BUILDS) {
    if (b === build) continue;
    for (const f of [b.file, `${b.file}.disabled`]) fs.rmSync(path.join(dir, f), { force: true });
  }
  if (!build) return null;
  if (e && e.enabled === false) return build.file;
  const src = path.join(MODS, build.file);
  const dest = path.join(dir, build.file);
  const st = fs.statSync(src);
  if (!fs.existsSync(dest) || fs.statSync(dest).size !== st.size || fs.statSync(dest).mtimeMs < st.mtimeMs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return build.file;
}

async function install(instId, onStatus) {
  let inst = instances.read(instId);
  if (!supports(inst)) throw new Error(`Lumen HUD supports Fabric ${GAME_VERSIONS.join(', ')} for now`);
  let fabric = Object.values(inst.content).find((e) => e.slug === 'fabric-api');
  if (!fabric) {
    onStatus && onStatus('Installing Fabric API');
    await instances.installContent(instId, 'fabric-api', 'mod', { onStatus });
    fabric = Object.values(instances.read(instId).content).find((e) => e.slug === 'fabric-api');
  }
  onStatus && onStatus('Installing Lumen HUD');
  inst = await instances.patch(instId, (i) => {
    i.content[ID] = {
      id: ID, slug: ID, title: 'Lumen HUD', icon: 'img/lumenhud.png', type: 'mod', builtin: true,
      file: buildFor(i.version).file, versionId: VERSION, versionNumber: VERSION, enabled: true, dependency: false, module: ID,
      needs: fabric ? [fabric.id] : [],
    };
    copyJar(i);
  });
  if (!fs.existsSync(configFile(instId))) resetConfig(instId);
  return { instance: inst, installed: ['Lumen HUD'] };
}

// Called before every launch so instances pick up a newer bundled jar, or the right build after a version change.
async function sync(instId) {
  const inst = instances.read(instId);
  const e = inst.content[ID];
  if (!e) return;
  const file = copyJar(inst);
  if (file === e.file) return;
  await instances.patch(instId, (i) => {
    if (!i.content[ID]) return;
    if (file) i.content[ID].file = file;
    else delete i.content[ID];
  });
}

// Real item textures for the launcher preview, taken from the downloaded client jar.
let iconCache;
function previewIcons() {
  if (iconCache) return iconCache;
  const names = ['diamond_helmet', 'iron_chestplate', 'diamond_leggings', 'golden_boots', 'netherite_sword'];
  const out = {};
  let have = [];
  try { have = fs.readdirSync(paths.versions).filter((v) => /^(\d+\.)+\d+$/.test(v)); } catch {}
  have.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of have) {
    const jar = path.join(paths.versions, v, `${v}.jar`);
    if (!fs.existsSync(jar)) continue;
    try {
      const zip = new AdmZip(jar);
      for (const n of names) {
        const e = zip.getEntry(`assets/minecraft/textures/item/${n}.png`);
        if (e) out[n] = `data:image/png;base64,${e.getData().toString('base64')}`;
      }
      break;
    } catch {}
  }
  iconCache = out;
  return out;
}

module.exports = { ID, VERSION, GAME_VERSIONS, matchers, PRESETS, SKINS, menuBackgroundFile, supports, defaults, getConfig, setConfig, resetConfig, install, sync, previewIcons };
