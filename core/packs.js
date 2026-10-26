// Modrinth modpacks (.mrpack): import, export, and installing a pack from Modrinth as a new instance.
// Format: https://docs.modrinth.com/docs/modpacks/format/
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const instances = require('./instances');
const mr = require('./modrinth');
const game = require('./game');
const { pool, download } = require('./net');

// The spec only lets launchers download from these hosts.
const ALLOWED_HOSTS = new Set(['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']);
const FOLDER_TYPE = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader' };
const MAX_UNPACKED = 2 * 1024 ** 3; // refuse zip bombs

// A pack is untrusted input: every path in it must stay inside the instance folder.
function safeRel(p) {
  const bad = () => new Error(`Unsafe path in modpack: ${p}`);
  if (typeof p !== 'string' || !p || path.isAbsolute(p) || /^[a-zA-Z]:/.test(p) || p.includes('\0')) throw bad();
  const norm = path.posix.normalize(p.replace(/\\/g, '/'));
  if (norm === '..' || norm.startsWith('../') || norm.startsWith('/')) throw bad();
  return norm;
}

function inside(dir, rel) {
  const dest = path.resolve(dir, rel);
  if (dest !== path.resolve(dir) && !dest.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Unsafe path in modpack: ${rel}`);
  return dest;
}

function allowedUrls(file) {
  return (file.downloads || []).filter((u) => {
    try {
      const x = new URL(u);
      return x.protocol === 'https:' && ALLOWED_HOSTS.has(x.hostname);
    } catch { return false; }
  });
}

// ---------- import ----------

async function importMrpack(file, { onStatus = () => {}, name } = {}) {
  let zip;
  try { zip = new AdmZip(file); } catch { throw new Error('This file is not a valid modpack archive'); }
  const entry = zip.getEntry('modrinth.index.json');
  if (!entry) throw new Error('Not a Modrinth modpack (modrinth.index.json is missing)');
  let index;
  try { index = JSON.parse(entry.getData().toString('utf8')); } catch { throw new Error('The modpack index is corrupted'); }
  if (index.formatVersion !== 1 || index.game !== 'minecraft') throw new Error('Unsupported modpack format');

  const deps = index.dependencies || {};
  if (!deps.minecraft) throw new Error('The modpack does not say which Minecraft version it needs');
  const unsupported = ['forge', 'neoforge', 'quilt-loader'].find((k) => deps[k]);
  if (unsupported) throw new Error(`This pack needs ${unsupported === 'quilt-loader' ? 'Quilt' : unsupported === 'forge' ? 'Forge' : 'NeoForge'}, which Lumen can't launch yet. Only Fabric and vanilla packs work.`);
  const loader = deps['fabric-loader'] ? 'fabric' : 'vanilla';

  // Validate everything before creating anything.
  const files = (index.files || []).filter((f) => !f.env || f.env.client !== 'unsupported').map((f) => {
    const rel = safeRel(f.path);
    const urls = allowedUrls(f);
    if (!urls.length) throw new Error(`No trusted download source for ${f.path}`);
    if (!f.hashes || !f.hashes.sha1) throw new Error(`No checksum for ${f.path}`);
    return { rel, urls, sha1: f.hashes.sha1, size: f.fileSize };
  });
  let unpacked = 0;
  const overrides = [];
  for (const prefix of ['overrides/', 'client-overrides/']) {
    for (const e of zip.getEntries()) {
      if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
      overrides.push({ e, rel: safeRel(e.entryName.slice(prefix.length)) });
      unpacked += e.header.size;
    }
  }
  if (unpacked > MAX_UNPACKED) throw new Error('The modpack is unreasonably large');

  const inst = instances.create({ name: (name || index.name || 'Imported pack').slice(0, 40), version: deps.minecraft, loader });
  const dir = instances.dirOf(inst.id);
  try {
    let done = 0;
    onStatus(`Downloading 0/${files.length} files`);
    await pool(files, 8, async (f) => {
      const dest = inside(dir, f.rel);
      let err;
      for (const url of f.urls) {
        try { await download(url, dest, { sha1: f.sha1, size: f.size }); err = null; break; } catch (e) { err = e; }
      }
      if (err) throw new Error(`Could not download ${f.rel}: ${err.message}`);
      onStatus(`Downloading ${++done}/${files.length} files`);
    });
    onStatus('Applying pack settings');
    for (const { e, rel } of overrides) {
      const dest = inside(dir, rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, e.getData());
    }

    // Recognise the files on Modrinth so they show up as tracked content (updates, removal, dependencies).
    onStatus('Identifying mods');
    const content = {};
    const tracked = files.filter((f) => /^(mods|resourcepacks|shaderpacks)\/[^/]+$/.test(f.rel));
    let found = {};
    try { found = await mr.lookupByHashes(tracked.map((f) => f.sha1)); } catch {}
    const versions = tracked.map((f) => ({ f, v: found[f.sha1] })).filter((x) => x.v);
    const projects = new Map();
    for (let i = 0; i < versions.length; i += 80) {
      try { for (const p of await mr.getProjects([...new Set(versions.slice(i, i + 80).map((x) => x.v.project_id))])) projects.set(p.id, p); } catch {}
    }
    for (const { f, v } of versions) {
      const p = projects.get(v.project_id);
      if (!p) continue;
      content[p.id] = {
        id: p.id, slug: p.slug, title: p.title, icon: p.icon_url, type: FOLDER_TYPE[f.rel.split('/')[0]],
        file: path.posix.basename(f.rel), versionId: v.id, versionNumber: v.version_number, enabled: true, dependency: false, module: null,
      };
    }
    return await instances.patch(inst.id, (i) => {
      i.content = content;
      if (deps['fabric-loader']) i.loaderVersion = deps['fabric-loader'];
    });
  } catch (e) {
    await instances.remove(inst.id); // never leave a half-installed pack behind
    throw e;
  }
}

// Downloads the newest Fabric version of a Modrinth modpack and imports it as a new instance.
async function installFromModrinth(projectId, { onStatus = () => {} } = {}) {
  const proj = await mr.getProject(projectId);
  const versions = await mr.listVersions(proj.id, ['fabric']);
  const ver = versions.find((v) => v.version_type === 'release') || versions[0];
  if (!ver) throw new Error(`${proj.title} has no Fabric version`);
  const file = ver.files.find((f) => f.primary) || ver.files[0];
  if (!file || !/\.mrpack$/i.test(file.filename)) throw new Error(`${proj.title} is not distributed as a .mrpack`);
  onStatus(`Downloading ${proj.title}`);
  const tmp = path.join(os.tmpdir(), 'lumen-packs');
  await fsp.mkdir(tmp, { recursive: true });
  const dest = path.join(tmp, `${proj.id}-${ver.id}.mrpack`);
  try {
    await download(file.url, dest, { sha1: file.hashes.sha1, size: file.size });
    return await importMrpack(dest, { onStatus, name: proj.title });
  } finally {
    await fsp.rm(dest, { force: true });
  }
}

// ---------- export ----------

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, base, out);
    else if (f.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

// Mods from Modrinth are listed by URL and checksum (small pack, verified on install); everything else is bundled.
async function exportMrpack(instId, dest, { onStatus = () => {} } = {}) {
  const inst = instances.read(instId);
  const dir = instances.dirOf(instId);
  const zip = new AdmZip();
  const files = [];
  const bundled = new Set();
  const folderOf = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };

  const entries = Object.values(inst.content).filter((e) => e.enabled !== false);
  let done = 0;
  await pool(entries, 8, async (e) => {
    const rel = `${folderOf[e.type]}/${e.file}`;
    onStatus(`Preparing ${++done}/${entries.length}`);
    if (e.builtin) { bundled.add(rel); return; } // Lumen HUD isn't on Modrinth
    try {
      const ver = await mr.getVersion(e.versionId);
      const f = ver.files.find((x) => x.filename === e.file) || ver.files.find((x) => x.primary) || ver.files[0];
      files.push({
        path: `${folderOf[e.type]}/${f.filename}`,
        hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
        env: { client: 'required', server: 'required' },
        downloads: [f.url],
        fileSize: f.size,
      });
    } catch {
      bundled.add(rel); // Modrinth lookup failed: ship the jar itself so the pack still works
    }
  });

  // Hand-placed jars and the config folder travel as overrides.
  const { local } = instances.listContent(instId);
  for (const l of local) if (l.enabled) bundled.add(`${folderOf[l.type]}/${l.file}`);
  for (const rel of bundled) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) zip.addFile(`overrides/${rel}`, fs.readFileSync(abs));
  }
  const cfgDir = path.join(dir, 'config');
  if (fs.existsSync(cfgDir)) for (const rel of walk(cfgDir)) zip.addFile(`overrides/config/${rel}`, fs.readFileSync(path.join(cfgDir, rel)));

  const dependencies = { minecraft: inst.version };
  if (inst.loader === 'fabric') dependencies['fabric-loader'] = inst.loaderVersion || await game.latestFabricLoader(inst.version);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const index = { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name: inst.name, summary: 'Exported from Lumen Client', files, dependencies };
  zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(index, null, 2)));
  zip.writeZip(dest);
  return { files: files.length, bundled: bundled.size };
}

module.exports = { importMrpack, installFromModrinth, exportMrpack, safeRel };
