// Instances live in <root>/instances/<id>/ which is also the game directory.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const paths = require('./paths');
const mr = require('./modrinth');
const { download, sha1File } = require('./net');
const { writeFileAtomic } = require('./fsutil');

const FOLDERS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };

const dirOf = (id) => path.join(paths.instances, id);
const fileOf = (id) => path.join(dirOf(id), 'instance.json');

function read(id) {
  const inst = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
  inst.content = inst.content || {};
  return inst;
}

function write(inst) {
  writeFileAtomic(fileOf(inst.id), JSON.stringify(inst, null, 2));
  return inst;
}

// instance.json is read-modify-written from several async flows (installs, launches, edits).
// Everything that mutates it goes through one queue per instance, so no update is lost.
const queues = new Map();
function withLock(id, fn) {
  const run = (queues.get(id) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  queues.set(id, tail);
  tail.then(() => { if (queues.get(id) === tail) queues.delete(id); });
  return run;
}

function patch(id, fn) {
  return withLock(id, async () => {
    const inst = read(id);
    await fn(inst);
    return write(inst);
  });
}

function list() {
  if (!fs.existsSync(paths.instances)) return [];
  return fs.readdirSync(paths.instances)
    .filter((d) => fs.existsSync(fileOf(d)))
    .map((d) => { try { return read(d); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (b.lastPlayed || b.created || 0) - (a.lastPlayed || a.created || 0));
}

function create({ name, version, loader, color }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'instance';
  const id = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  const inst = { id, name, version, loader, loaderVersion: null, color: color || null, created: Date.now(), lastPlayed: null, playtime: 0, content: {} };
  for (const f of Object.values(FOLDERS)) fs.mkdirSync(path.join(dirOf(id), f), { recursive: true });
  return write(inst);
}

// A copy to experiment on without touching the original: same version, mods and settings.
// Worlds are optional because they can be large; logs, crash reports and screenshots are never copied.
async function duplicate(id, name, { worlds = false } = {}) {
  const src = read(id);
  const copy = create({ name: (name || `${src.name} (copy)`).trim().slice(0, 40), version: src.version, loader: src.loader, color: src.color });
  try {
    await patch(copy.id, (c) => {
      c.loaderVersion = src.loaderVersion;
      c.ram = src.ram;
      c.jvmArgs = src.jvmArgs;
      c.content = JSON.parse(JSON.stringify(src.content));
    });
    const skip = new Set(['instance.json', 'logs', 'crash-reports', 'screenshots', ...(worlds ? [] : ['saves'])]);
    for (const entry of fs.readdirSync(dirOf(id))) {
      if (skip.has(entry)) continue;
      await fsp.cp(path.join(dirOf(id), entry), path.join(dirOf(copy.id), entry), { recursive: true });
    }
    return read(copy.id);
  } catch (e) {
    await remove(copy.id); // never leave a half-copied instance behind
    throw e;
  }
}

function update(id, changes) {
  return patch(id, (inst) => {
    // Changing version or loader invalidates the pinned loader build.
    const loaderChanged = (changes.version && changes.version !== inst.version) || (changes.loader && changes.loader !== inst.loader);
    Object.assign(inst, changes, { id });
    if (loaderChanged) inst.loaderVersion = null;
  });
}

async function remove(id) {
  await fsp.rm(dirOf(id), { recursive: true, force: true });
}

function contentPath(inst, entry) {
  const p = path.join(dirOf(inst.id), FOLDERS[entry.type], entry.file);
  return entry.enabled === false ? `${p}.disabled` : p;
}

// Project ids of the required dependencies of a Modrinth version.
async function requiredProjects(ver) {
  const out = [];
  for (const dep of ver.dependencies || []) {
    if (dep.dependency_type !== 'required') continue;
    let pid = dep.project_id;
    if (!pid && dep.version_id) pid = (await mr.getVersion(dep.version_id)).project_id;
    if (pid) out.push(pid);
  }
  return out;
}

// Installs a Modrinth project (and its required dependencies) into the instance.
// All-or-nothing: if anything fails, files and entries added by this call are rolled back, and
// replaced files are only deleted at the very end, so a failed update never leaves a broken mod.
function installContent(id, idOrSlug, type, { module, onStatus, dependency } = {}) {
  return withLock(id, async () => {
    const inst = read(id);
    const installed = [];
    const created = [];
    const obsolete = [];

    const visit = async (ref, t, isDep, seen) => {
      const proj = await mr.getProject(ref);
      if (seen.has(proj.id)) return;
      seen.add(proj.id);
      if (isDep && inst.content[proj.id]) return;
      onStatus && onStatus(`Installing ${proj.title}`);
      const ver = await mr.getCompatibleVersion(proj.id, t, inst.version, inst.loader);
      if (!ver) {
        if (isDep) throw new Error(`Required dependency ${proj.title} has no build for ${inst.version}`);
        throw new Error(`${proj.title} is not available for ${inst.loader === 'vanilla' && t === 'mod' ? 'vanilla' : inst.version}`);
      }
      // A universal jar (e.g. Fabric + NeoForge) lists the dependencies of every loader it supports, such as
      // a NeoForge-only library. Those aren't needed here and can't be installed, so drop them.
      const needs = [];
      for (const pid of await requiredProjects(ver)) {
        const dep = await mr.getProject(pid);
        if (t === 'mod' && dep.loaders && !dep.loaders.includes(inst.loader)) continue;
        needs.push(pid);
      }
      const file = ver.files.find((f) => f.primary) || ver.files[0];
      const prev = inst.content[proj.id];
      const dest = path.join(dirOf(id), FOLDERS[t], file.filename);
      await download(file.url, dest, { sha1: file.hashes.sha1, size: file.size });
      const enabled = !prev || prev.enabled !== false; // updating a disabled mod keeps it disabled
      if (!enabled) {
        await fsp.rm(`${dest}.disabled`, { force: true });
        await fsp.rename(dest, `${dest}.disabled`);
      }
      if (prev && prev.file !== file.filename) obsolete.push(contentPath(inst, prev));
      inst.content[proj.id] = {
        id: proj.id, slug: proj.slug, title: proj.title, icon: proj.icon_url, type: t,
        file: file.filename, versionId: ver.id, versionNumber: ver.version_number, enabled,
        dependency: prev ? prev.dependency && isDep : isDep,
        module: (!isDep && module) || (prev && prev.module) || null,
        needs,
      };
      created.push({ id: proj.id, prev, name: file.filename, dest: enabled ? dest : `${dest}.disabled` });
      installed.push(proj.title);
      for (const pid of needs) await visit(pid, 'mod', true, seen);
    };

    try {
      await visit(idOrSlug, type, !!dependency, new Set()); // `dependency`: installed on behalf of another mod
    } catch (e) {
      for (const c of created.reverse()) {
        if (c.prev) inst.content[c.id] = c.prev;
        else delete inst.content[c.id];
        if (!c.prev || c.prev.file !== c.name) await fsp.rm(c.dest, { force: true });
      }
      write(inst);
      throw e;
    }
    for (const f of obsolete) await fsp.rm(f, { force: true });
    write(inst);
    return { instance: inst, installed };
  });
}

// Entries installed before dependency tracking have no `needs`; ask Modrinth once and remember it.
async function backfillNeeds(inst) {
  const fabric = Object.values(inst.content).find((e) => e.slug === 'fabric-api');
  for (const e of Object.values(inst.content)) {
    if (Array.isArray(e.needs)) continue;
    if (e.builtin) { e.needs = fabric ? [fabric.id] : []; continue; }
    if (!e.versionId) continue;
    try { e.needs = await requiredProjects(await mr.getVersion(e.versionId)); } catch {}
  }
}

function backfill(id) {
  return patch(id, (inst) => backfillNeeds(inst));
}

// Refuses to remove something other mods need; also removes auto-installed dependencies that
// nothing needs any more. Returns the instance with `removed` (titles) attached for the UI.
function removeContent(id, projectId) {
  return withLock(id, async () => {
    const inst = read(id);
    const e = inst.content[projectId];
    if (!e) return inst;
    await backfillNeeds(inst);
    const users = Object.values(inst.content).filter((x) => x.id !== projectId && (x.needs || []).includes(projectId));
    if (users.length) throw new Error(`${e.title} is required by ${users.map((x) => x.title).join(', ')}. Remove those first.`);
    const removed = [];
    const drop = async (x) => {
      await fsp.rm(contentPath(inst, x), { force: true });
      delete inst.content[x.id];
      removed.push(x.title);
    };
    await drop(e);
    // Only sweep when every remaining entry's needs are known, otherwise we could delete something in use.
    while (Object.values(inst.content).every((x) => Array.isArray(x.needs))) {
      const needed = new Set(Object.values(inst.content).flatMap((x) => x.needs));
      const orphan = Object.values(inst.content).find((x) => x.dependency === true && !needed.has(x.id));
      if (!orphan) break;
      await drop(orphan);
    }
    write(inst);
    return Object.assign(inst, { removed });
  });
}

async function removeLocalFile(id, type, file) {
  await fsp.rm(path.join(dirOf(id), FOLDERS[type], file), { force: true });
}

// What kind of content is this file? Returns { type } or { error }.
function classifyFile(file, inst, hint) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.jar' && ext !== '.zip') return { error: `has an unsupported type (${ext || 'no extension'}); use .jar, .zip or .mrpack` };
  let names;
  try { names = new AdmZip(file).getEntries().map((e) => e.entryName); } catch { return { error: 'is not a valid .jar/.zip archive' }; }
  if (ext === '.jar') {
    if (inst.loader !== 'fabric') return { error: 'is a mod, but this instance is vanilla. Switch it to Fabric first' };
    if (!names.includes('fabric.mod.json') && !names.includes('quilt.mod.json')) return { error: "isn't a Fabric mod (it looks like a Forge/NeoForge mod, which can't run here)" };
    return { type: 'mod' };
  }
  if (ext === '.zip') {
    if (names.some((n) => n.startsWith('shaders/'))) return { type: 'shader' };
    if (names.includes('pack.mcmeta')) return { type: 'resourcepack' };
    if (hint === 'shader' || hint === 'resourcepack') return { type: hint };
    return { error: "isn't a resource pack or shader pack (no pack.mcmeta or shaders folder)" };
  }
  return { error: `has an unsupported type (${ext || 'no extension'}); use .jar, .zip or .mrpack` };
}

// Copies files the user dropped on the launcher into the right folder, and recognises them on Modrinth
// (by checksum) so they get update checks like any installed mod.
async function addFiles(id, files, hint) {
  const added = [];
  const rejected = [];
  const inst = read(id);
  const copied = [];
  for (const file of files) {
    const name = path.basename(file);
    const c = classifyFile(file, inst, hint);
    if (c.error) { rejected.push({ file: name, reason: c.error }); continue; }
    const dest = path.join(dirOf(id), FOLDERS[c.type], name);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(file, dest);
    copied.push({ name, type: c.type, dest });
  }
  if (copied.length) {
    let found = {};
    const hashes = new Map();
    for (const f of copied) hashes.set(await sha1File(f.dest), f);
    try { found = await mr.lookupByHashes([...hashes.keys()]); } catch {}
    await patch(id, async (i) => {
      for (const [hash, f] of hashes) {
        const v = found[hash];
        let tracked = false;
        if (v && !i.content[v.project_id]) {
          try {
            const p = await mr.getProject(v.project_id);
            i.content[p.id] = { id: p.id, slug: p.slug, title: p.title, icon: p.icon_url, type: f.type, file: f.name, versionId: v.id, versionNumber: v.version_number, enabled: true, dependency: false, module: null };
            tracked = true;
          } catch {}
        }
        added.push({ file: f.name, type: f.type, tracked });
      }
    });
  }
  return { added, rejected };
}

function toggleContent(id, projectId, enabled) {
  return withLock(id, async () => {
    const inst = read(id);
    const e = inst.content[projectId];
    if (!e) return inst;
    const from = contentPath(inst, e);
    e.enabled = enabled;
    const to = contentPath(inst, e);
    if (from !== to && fs.existsSync(from)) await fsp.rename(from, to);
    return write(inst);
  });
}

// Tracked content plus any files the user dropped in manually.
function listContent(id) {
  const inst = read(id);
  const tracked = Object.values(inst.content);
  const known = new Set(tracked.map((e) => e.file));
  const local = [];
  for (const [type, folder] of Object.entries(FOLDERS)) {
    const dir = path.join(dirOf(id), folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const base = f.replace(/\.disabled$/, '');
      if (known.has(base) || f.endsWith('.part')) continue;
      local.push({ type, file: f, title: base, enabled: !f.endsWith('.disabled'), local: true });
    }
  }
  return { tracked, local };
}

async function toggleLocal(id, type, file, enabled) {
  const dir = path.join(dirOf(id), FOLDERS[type]);
  const base = file.replace(/\.disabled$/, '');
  await fsp.rename(path.join(dir, file), path.join(dir, enabled ? base : `${base}.disabled`));
}

// One request per content type (mods / resource packs / shaders) instead of one per mod, so a pack with
// 150 mods is checked in a second and doesn't hit Modrinth's rate limit.
async function checkUpdates(id) {
  const inst = read(id);
  const updates = [];
  const entries = Object.values(inst.content).filter((e) => !e.builtin);
  const perMod = async (e) => {
    try {
      const v = await mr.getCompatibleVersion(e.id, e.type, inst.version, inst.loader, { fresh: true });
      if (v && v.id !== e.versionId) updates.push({ id: e.id, title: e.title, from: e.versionNumber, to: v.version_number, type: e.type });
    } catch {}
  };
  for (const type of Object.keys(FOLDERS)) {
    const group = entries.filter((e) => e.type === type);
    if (!group.length) continue;
    const byHash = new Map();
    await Promise.all(group.map(async (e) => { try { byHash.set(await sha1File(contentPath(inst, e)), e); } catch {} }));
    let latest;
    try { latest = await mr.latestForHashes([...byHash.keys()], type, inst.loader, inst.version); } catch { latest = null; }
    if (!latest) { await Promise.all(group.map(perMod)); continue; } // batch endpoint unavailable: fall back
    for (const [hash, e] of byHash) {
      const v = latest[hash];
      // The endpoint returns the newest build of any kind; like installs, only offer releases.
      if (v && v.id !== e.versionId && v.version_type === 'release') updates.push({ id: e.id, title: e.title, from: e.versionNumber, to: v.version_number, type: e.type });
    }
    // Files we could not hash (deleted/renamed by hand) are checked the slow way.
    await Promise.all(group.filter((e) => ![...byHash.values()].includes(e)).map(perMod));
  }
  return updates;
}

function listScreenshots(id) {
  const dir = path.join(dirOf(id), 'screenshots');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { name: f, path: p, time: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.time - a.time);
}

module.exports = {
  FOLDERS, dirOf, read, write, patch, withLock, backfill, list, create, update, remove, contentFile: contentPath, addFiles, duplicate,
  installContent, removeContent, removeLocalFile, toggleContent, toggleLocal, listContent, checkUpdates, listScreenshots,
};
