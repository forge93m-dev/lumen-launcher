// Graphics profiles: one click to trade looks for FPS (and back) in an instance. They are lines in options.txt; every other
// line is left alone. Options a Minecraft version does not know are ignored by the game, so one list serves all versions.
const fs = require('fs');
const path = require('path');
const instances = require('./instances');
const { writeFileAtomic } = require('./fsutil');

const optionsFile = (id) => path.join(instances.dirOf(id), 'options.txt');

// What each profile sets. graphicsMode: 0 fast, 1 fancy, 2 fabulous.
const PROFILES = [
  {
    id: 'quality', name: 'Quality', desc: 'Far view, fabulous graphics, smooth lighting. For strong computers.',
    options: { renderDistance: 20, simulationDistance: 12, graphicsMode: 2, fancyGraphics: 'true', particles: 0, entityShadows: 'true', renderClouds: '"true"', ao: 'true', biomeBlendRadius: 5, mipmapLevels: 4, entityDistanceScaling: '1.5' },
  },
  {
    id: 'balanced', name: 'Balanced', desc: 'Good looks at a steady frame rate. The default for most computers.',
    options: { renderDistance: 12, simulationDistance: 10, graphicsMode: 1, fancyGraphics: 'true', particles: 1, entityShadows: 'true', renderClouds: '"true"', ao: 'true', biomeBlendRadius: 2, mipmapLevels: 2, entityDistanceScaling: '1.0' },
  },
  {
    id: 'performance', name: 'Performance', desc: 'Shorter view, fast graphics, fewer particles. Noticeably more FPS.',
    options: { renderDistance: 8, simulationDistance: 6, graphicsMode: 0, fancyGraphics: 'false', particles: 1, entityShadows: 'false', renderClouds: '"false"', ao: 'false', biomeBlendRadius: 0, mipmapLevels: 0, entityDistanceScaling: '0.75' },
  },
  {
    id: 'potato', name: 'Potato', desc: 'The lowest settings. For weak computers, or while another game is running.',
    options: { renderDistance: 4, simulationDistance: 5, graphicsMode: 0, fancyGraphics: 'false', particles: 2, entityShadows: 'false', renderClouds: '"false"', ao: 'false', biomeBlendRadius: 0, mipmapLevels: 0, entityDistanceScaling: '0.5' },
  },
];

const readLines = (id) => {
  try { return fs.readFileSync(optionsFile(id), 'utf8').split(/\r?\n/); } catch { return []; }
};

const valueOf = (lines, key) => {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  return line === undefined ? undefined : line.slice(key.length + 1).trim();
};

// The profile whose headline settings (view distance, graphics mode, particles) the instance has, or null for "custom".
function current(id) {
  const lines = readLines(id);
  const rd = valueOf(lines, 'renderDistance');
  if (rd === undefined) return null; // the game has not written options yet: nothing is set
  for (const p of PROFILES) {
    const o = p.options;
    const gm = valueOf(lines, 'graphicsMode');
    if (rd === String(o.renderDistance) && (gm === undefined || gm === String(o.graphicsMode)) && valueOf(lines, 'particles') === String(o.particles)) return p.id;
  }
  return null;
}

function apply(id, profile) {
  const p = PROFILES.find((x) => x.id === profile);
  if (!p) throw new Error('Unknown graphics profile');
  const lines = readLines(id).filter((l, i, a) => l !== '' || i < a.length - 1);
  for (const [key, value] of Object.entries(p.options)) {
    const line = `${key}:${value}`;
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i >= 0) lines[i] = line;
    else lines.push(line);
  }
  writeFileAtomic(optionsFile(id), `${lines.join('\n')}\n`);
  return p.id;
}

const list = () => PROFILES.map(({ id, name, desc }) => ({ id, name, desc }));

module.exports = { PROFILES, list, current, apply };
