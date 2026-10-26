// Disk usage of the launcher's data folder, and cleanup of things no instance needs any more.
// Only whole version folders and Java runtimes are ever removed; both are downloaded again on demand.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const paths = require('./paths');
const instances = require('./instances');

async function sizeOf(dir) {
  let total = 0;
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  await Promise.all(entries.map(async (e) => {
    const p = path.join(dir, e.name);
    try {
      // Await first, then add: `total += await x` reads `total` before the wait and would overwrite
      // whatever the other parallel branches added in the meantime.
      const n = e.isDirectory() ? await sizeOf(p) : e.isFile() ? (await fsp.stat(p)).size : 0;
      total += n;
    } catch {}
  }));
  return total;
}

const subdirs = async (dir) => {
  try { return (await fsp.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; }
};

// Which version folders / Java runtimes do the existing instances still use?
async function inUse() {
  const list = instances.list();
  const versions = new Set();
  const loaderPrefixes = []; // fabric builds that are not pinned yet: keep every loader build for that game version
  const components = new Set();
  let componentsKnown = true;
  for (const inst of list) {
    versions.add(inst.version);
    if (inst.loader === 'fabric') {
      if (inst.loaderVersion) versions.add(`fabric-loader-${inst.loaderVersion}-${inst.version}`);
      else loaderPrefixes.push(inst.version);
    }
    try {
      const j = JSON.parse(await fsp.readFile(path.join(paths.versions, inst.version, `${inst.version}.json`), 'utf8'));
      components.add((j.javaVersion && j.javaVersion.component) || 'jre-legacy');
    } catch { componentsKnown = false; } // a version we have never downloaded: we can't tell which Java it needs yet
  }
  const keepVersion = (id) => versions.has(id) || loaderPrefixes.some((v) => id.startsWith('fabric-loader-') && id.endsWith(`-${v}`));
  return { keepVersion, components, componentsKnown };
}

async function usage() {
  const [libs, assets, runtimeNames, versionNames, instanceList] = await Promise.all([
    sizeOf(paths.libraries), sizeOf(paths.assets), subdirs(paths.runtimes), subdirs(paths.versions), Promise.resolve(instances.list()),
  ]);
  const keep = await inUse();
  const versions = await Promise.all(versionNames.map(async (id) => ({ id, bytes: await sizeOf(path.join(paths.versions, id)) })));
  const runtimes = await Promise.all(runtimeNames.map(async (id) => ({ id, bytes: await sizeOf(path.join(paths.runtimes, id)) })));
  const inst = await Promise.all(instanceList.map(async (i) => ({ id: i.id, name: i.name, bytes: await sizeOf(instances.dirOf(i.id)) })));
  const unusedVersions = versions.filter((v) => !keep.keepVersion(v.id));
  const unusedRuntimes = keep.componentsKnown ? runtimes.filter((r) => !keep.components.has(r.id)) : [];
  const sum = (a) => a.reduce((n, x) => n + x.bytes, 0);
  return {
    total: libs + assets + sum(versions) + sum(runtimes) + sum(inst),
    parts: [
      { key: 'instances', label: 'Instances (worlds, mods, screenshots)', bytes: sum(inst), detail: inst.sort((a, b) => b.bytes - a.bytes) },
      { key: 'assets', label: 'Game assets (sounds, languages)', bytes: assets },
      { key: 'libraries', label: 'Libraries', bytes: libs },
      { key: 'runtimes', label: 'Java runtimes', bytes: sum(runtimes) },
      { key: 'versions', label: 'Minecraft versions', bytes: sum(versions) },
    ],
    unused: { versions: unusedVersions, runtimes: unusedRuntimes, bytes: sum(unusedVersions) + sum(unusedRuntimes) },
  };
}

// Removes what usage() reports as unused. Recomputed here, so a stale list from the UI can't delete something in use.
async function clean() {
  const u = (await usage()).unused;
  let freed = 0;
  const removed = [];
  const drop = async (root, id, bytes) => {
    const target = path.resolve(root, id);
    if (path.dirname(target) !== path.resolve(root)) return; // only direct children of the folder
    await fsp.rm(target, { recursive: true, force: true });
    freed += bytes;
    removed.push(id);
  };
  for (const v of u.versions) await drop(paths.versions, v.id, v.bytes);
  for (const r of u.runtimes) await drop(paths.runtimes, r.id, r.bytes);
  return { freed, removed };
}

module.exports = { usage, clean };
