// Launch doctor: spots mod problems before the game starts and after Fabric refuses to load,
// and knows how to fix the common ones (a deleted jar, a missing dependency).
const fs = require('fs');
const path = require('path');
const instances = require('./instances');
const mr = require('./modrinth');

// Entries in Fabric's messages that are not installable mods.
const NOT_MODS = new Set(['minecraft', 'java', 'fabricloader', 'fabric-loader']);

// ---------- before launching ----------

// Offline-ish checks on what the launcher itself installed. Returns what is broken and how it can be fixed.
async function preflight(instId) {
  let inst = instances.read(instId);
  if (inst.loader !== 'fabric') return { missingFiles: [], missingDeps: [], uncertain: false };
  // Entries from before dependency tracking have no `needs`; fill them in once so we can reason about them.
  if (Object.values(inst.content).some((e) => e.type === 'mod' && !e.builtin && !Array.isArray(e.needs))) {
    try { inst = await instances.backfill(instId); } catch {}
  }
  const dir = instances.dirOf(instId);
  const mods = Object.values(inst.content).filter((e) => e.type === 'mod' && e.enabled !== false);

  const missingFiles = mods
    .filter((e) => !e.builtin && !fs.existsSync(path.join(dir, 'mods', e.file)))
    .map((e) => ({ id: e.id, title: e.title, file: e.file, type: e.type }));

  // Jars the user dropped in by hand might provide a dependency under a different name; then we can't be sure.
  const { local } = instances.listContent(instId);
  const localJars = local.filter((f) => f.type === 'mod' && f.enabled);
  const present = new Set(mods.map((e) => e.id));
  const wanted = new Map(); // project id -> titles of the mods that need it
  for (const e of mods) {
    for (const pid of e.needs || []) {
      if (present.has(pid)) continue;
      if (!wanted.has(pid)) wanted.set(pid, []);
      wanted.get(pid).push(e.title);
    }
  }
  const missingDeps = [];
  if (wanted.size && !localJars.length) {
    let projects = [];
    try { projects = await mr.getProjects([...wanted.keys()]); } catch {}
    for (const p of projects) {
      // Skip things that don't exist for this loader (e.g. a NeoForge-only library listed by a universal jar).
      if (p.loaders && !p.loaders.includes(inst.loader)) continue;
      missingDeps.push({ id: p.id, title: p.title, needBy: wanted.get(p.id) });
    }
  }
  return { missingFiles, missingDeps, uncertain: wanted.size > 0 && localJars.length > 0 };
}

// Re-downloads deleted jars and installs missing dependencies.
async function fix(instId, { reinstall = [], install = [] } = {}) {
  const fixed = [];
  for (const id of reinstall) {
    const e = instances.read(instId).content[id];
    if (!e || e.builtin) continue;
    await instances.installContent(instId, id, e.type, {});
    fixed.push(e.title);
  }
  for (const id of install) {
    const e = instances.read(instId).content[id];
    if (e && e.enabled === false) { // it is already there, just switched off
      await instances.toggleContent(instId, id, true);
      fixed.push(e.title);
      continue;
    }
    const r = await instances.installContent(instId, id, e ? e.type : 'mod', e ? {} : { dependency: true });
    fixed.push(...r.installed);
  }
  return { fixed };
}

// ---------- after Fabric reports a problem ----------

// Pulls the mod ids Fabric says are missing out of its "Incompatible mods found!" report.
function parseFabricError(text) {
  const ids = new Set();
  for (const m of text.matchAll(/^\s*-\s*Install ([A-Za-z0-9_.\-]+)/gm)) ids.add(m[1]);
  for (const m of text.matchAll(/of ([A-Za-z0-9_.\-]+), which is missing!/g)) ids.add(m[1]);
  // Everything else Fabric suggests (replace/remove) needs a human decision.
  const other = [];
  for (const m of text.matchAll(/^\s*-\s*((?:Replace|Remove|Update|Upgrade)[^\n]*)/gm)) other.push(m[1].trim());
  const details = [...text.matchAll(/^\s*-\s*(Mod '[^\n]*)/gm)].map((m) => m[1].trim());
  return { ids: [...ids].filter((id) => !NOT_MODS.has(id)), other, details };
}

// Mod ids rarely equal Modrinth slugs (yet_another_config_lib_v3 is "yacl"), so try a few ways to find the project.
async function resolveModId(id, inst) {
  // Every Fabric API module (fabric-resource-loader-v0, ...) ships inside Fabric API itself.
  const key = id === 'fabric' || /^fabric-.*-v\d+$/.test(id) ? 'fabric-api' : id;
  try {
    const p = await mr.getProject(key);
    if (!p.loaders || p.loaders.includes(inst.loader)) return { id: p.id, title: p.title, slug: p.slug };
  } catch {}
  const words = key.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\bv\d+$/, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  try {
    const r = await mr.search({ query: words.join(' '), type: 'mod', gameVersion: inst.version, loader: inst.loader, limit: 8 });
    const hit = r.hits.find((h) => words.every((w) => `${h.title} ${h.slug}`.toLowerCase().includes(w)));
    if (hit) return { id: hit.project_id, title: hit.title, slug: hit.slug };
  } catch {}
  return null;
}

async function resolve(instId, modIds) {
  const inst = instances.read(instId);
  const found = new Map();
  const unknown = [];
  for (const id of modIds) {
    if (NOT_MODS.has(id)) continue; // the game, Java and the loader aren't something we can install
    const p = await resolveModId(id, inst);
    if (!p) { unknown.push(id); continue; }
    if (found.has(p.id)) continue;
    // Fabric says it is missing, but the launcher may know it: switched off, or its jar deleted by hand.
    const e = inst.content[p.id];
    let action = 'install';
    if (e) {
      if (e.enabled === false) action = 'enable';
      else if (!fs.existsSync(instances.contentFile(inst, e))) action = 'reinstall';
      else continue; // present and on: the complaint is about something else (a version clash), which we can't fix
    }
    found.set(p.id, { ...p, action });
  }
  return { projects: [...found.values()], unknown };
}

// ---------- watching a running game ----------

// Feed it every log line. When Fabric prints its incompatibility report it calls onProblem once,
// with the parsed report, after the report has finished printing.
function createWatcher(onProblem, onOom) {
  let buf = null;
  let oomSeen = false;
  return (line) => {
    if (!oomSeen && onOom && /java\.lang\.OutOfMemoryError|There is insufficient memory for the Java Runtime/.test(line)) {
      oomSeen = true; // the same error is usually printed several times
      onOom(line);
    }
    if (buf) { buf.push(line); return; }
    if (!/Incompatible mods? found!?/.test(line)) return;
    buf = [line];
    setTimeout(() => {
      const text = buf.join('\n');
      onProblem({ ...parseFabricError(text), text });
    }, 800);
  };
}

// Newest crash report written since `sinceMs`, with its one-line description.
function findCrashReport(instId, sinceMs) {
  const dir = path.join(instances.dirOf(instId), 'crash-reports');
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .filter((x) => x.t >= sinceMs - 2000)
      .sort((a, b) => b.t - a.t);
    if (!files.length) return null;
    const file = path.join(dir, files[0].f);
    const head = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 12);
    const description = (head.find((l) => l.startsWith('Description:')) || '').replace('Description:', '').trim();
    return { file, description, name: files[0].f };
  } catch {
    return null;
  }
}

module.exports = { preflight, fix, parseFabricError, resolve, createWatcher, findCrashReport };
