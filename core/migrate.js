// Moving an instance to another Minecraft version without breaking its mods.
const instances = require('./instances');
const mr = require('./modrinth');
const hud = require('./hud');
const { sha1File } = require('./net');

const typeOf = (e) => e.type;

// What would happen to each tracked mod/pack on `version`? One batched request per content type.
async function plan(id, version) {
  const inst = instances.read(id);
  const entries = Object.values(inst.content).filter((e) => !e.builtin);
  const ok = [];
  const missing = [];
  for (const type of Object.keys(instances.FOLDERS)) {
    const group = entries.filter((e) => typeOf(e) === type);
    if (!group.length) continue;
    const byHash = new Map();
    await Promise.all(group.map(async (e) => {
      try { byHash.set(await sha1File(instances.contentFile(inst, e)), e); } catch {}
    }));
    let latest = {};
    try { latest = await mr.latestForHashes([...byHash.keys()], type, inst.loader, version); } catch { latest = null; }
    for (const e of group) {
      let v = null;
      const hash = [...byHash.entries()].find(([, x]) => x === e);
      if (latest && hash) v = latest[hash[0]];
      else v = await mr.getCompatibleVersion(e.id, type, version, inst.loader, { fresh: true }).catch(() => null);
      if (v) ok.push({ id: e.id, type, title: e.title, from: e.versionNumber, to: v.version_number });
      else missing.push({ id: e.id, type, title: e.title, enabled: e.enabled !== false });
    }
  }
  const hasHud = !!inst.content[hud.ID];
  return {
    version,
    ok,
    // A mod that is already switched off isn't a new problem.
    missing: missing.filter((m) => m.enabled),
    hud: !hasHud ? 'none' : hud.supports({ loader: inst.loader, version }) ? 'keep' : 'remove',
  };
}

// Switches the version, updates every mod that has a build, and turns off the ones that don't
// (a jar built for the old version would stop the game from starting).
async function apply(id, version, { onStatus = () => {} } = {}) {
  const p = await plan(id, version);
  await instances.update(id, { version });
  const updated = [];
  const failed = [];
  const off = [...p.missing];
  for (const m of p.ok) {
    onStatus(`Updating ${m.title}`);
    try {
      await instances.installContent(id, m.id, m.type, {});
      updated.push(m.title);
    } catch (e) {
      failed.push({ title: m.title, error: e.message });
      off.push({ id: m.id, type: m.type, title: m.title });
    }
  }
  for (const m of off) {
    try {
      await instances.toggleContent(id, m.id, false);
      await instances.patch(id, (i) => { if (i.content[m.id]) i.content[m.id].incompatible = version; });
    } catch {}
  }
  await hud.sync(id); // swaps the Lumen HUD build for the new version, or drops it where there is none
  return { updated, disabled: off.map((m) => m.title), failed, hud: p.hud };
}

module.exports = { plan, apply };
