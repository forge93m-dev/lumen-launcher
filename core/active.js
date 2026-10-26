// Which resource packs / shader pack an instance has switched on. Minecraft keeps this in options.txt
// (resourcePacks) and Iris in config/iris.properties (shaderPack); we edit those lines and leave the rest alone.
const fs = require('fs');
const path = require('path');
const instances = require('./instances');
const { writeFileAtomic } = require('./fsutil');

const optionsFile = (id) => path.join(instances.dirOf(id), 'options.txt');
const irisFile = (id) => path.join(instances.dirOf(id), 'config', 'iris.properties');

const readLines = (file) => {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { return []; }
};
const writeLines = (file, lines) => writeFileAtomic(file, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n');

// ---------- resource packs ----------

function parseList(line) {
  try { const v = JSON.parse(line.slice(line.indexOf(':') + 1)); return Array.isArray(v) ? v : []; } catch { return []; }
}

function resourcePacks(id) {
  const line = readLines(optionsFile(id)).find((l) => l.startsWith('resourcePacks:'));
  return line ? parseList(line).filter((n) => n.startsWith('file/')).map((n) => n.slice(5)) : [];
}

// Later entries have higher priority, so a pack that is switched on goes last.
function setResourcePack(id, file, on) {
  const lines = readLines(optionsFile(id));
  const i = lines.findIndex((l) => l.startsWith('resourcePacks:'));
  const list = (i >= 0 ? parseList(lines[i]) : ['vanilla']).filter((n) => n !== `file/${file}`);
  if (on) list.push(`file/${file}`);
  const line = `resourcePacks:${JSON.stringify(list)}`;
  if (i >= 0) lines[i] = line;
  else lines.push(line);
  writeLines(optionsFile(id), lines);
}

// ---------- shaders (Iris) ----------

function activeShader(id) {
  const lines = readLines(irisFile(id));
  const get = (k) => (lines.find((l) => l.startsWith(`${k}=`)) || '').slice(k.length + 1).trim();
  return get('enableShaders') !== 'false' && get('shaderPack') ? get('shaderPack') : null;
}

function setShader(id, file) {
  const lines = readLines(irisFile(id));
  const set = (k, v) => {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  };
  set('enableShaders', file ? 'true' : 'false');
  if (file) set('shaderPack', file);
  writeLines(irisFile(id), lines);
}

function get(id) {
  return { resourcepacks: resourcePacks(id), shader: activeShader(id) };
}

// Turn a pack on or off. `type` is 'resourcepack' or 'shader'.
function use(id, type, file, on) {
  const safe = path.basename(file);
  if (type === 'resourcepack') setResourcePack(id, safe, on);
  else if (type === 'shader') setShader(id, on ? safe : null);
  else throw new Error('Only resource packs and shader packs can be switched on');
  return get(id);
}

module.exports = { get, use, resourcePacks, activeShader };
