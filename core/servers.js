// Puts the servers saved in the launcher into the game's own multiplayer list (<instance>/servers.dat),
// so they are there when the player opens Multiplayer. Entries already in the game are never changed or removed.
const fs = require('fs');
const path = require('path');
const nbt = require('./nbt');
const instances = require('./instances');
const { writeFileAtomic } = require('./fsutil');

const norm = (ip) => String(ip).trim().toLowerCase().replace(/:25565$/, '');
const str = (v) => ({ type: nbt.T.STRING, value: v });

// Returns how many servers were added.
function sync(instId, servers) {
  const file = path.join(instances.dirOf(instId), 'servers.dat');
  let root;
  if (fs.existsSync(file)) {
    try { root = nbt.parse(fs.readFileSync(file)); } catch { return 0; } // unreadable file: leave it alone
  } else {
    root = { name: '', value: new Map() };
  }
  let list = root.value.get('servers');
  if (!list || list.type !== nbt.T.LIST) {
    if (list) return 0; // "servers" exists but is something unexpected
    list = { type: nbt.T.LIST, value: { elementType: nbt.T.COMPOUND, items: [] } };
    root.value.set('servers', list);
  }
  const have = new Set(list.value.items.map((m) => m.get('ip') && norm(m.get('ip').value)));
  let added = 0;
  for (const s of servers) {
    const ip = String(s.address || '').trim();
    if (!ip || have.has(norm(ip))) continue;
    list.value.items.push(new Map([['name', str(String(s.name || ip).slice(0, 64))], ['ip', str(ip)]]));
    list.value.elementType = nbt.T.COMPOUND;
    have.add(norm(ip));
    added++;
  }
  if (added) writeFileAtomic(file, nbt.serialize(root));
  return added;
}

module.exports = { sync };
