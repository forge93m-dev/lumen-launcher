// The in-game menu runs headless (no Minecraft, no window): it must draw all its pages and answer clicks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const preview = require('../../scripts/preview-menu');

// The library the in-game menu writes must be one the launcher reads (same index.json, same pictures). Set before skins.js loads.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-menu-lib-'));
process.env.LUMEN_HOME = home;
const skins = require('../../core/skins');
const png = require('../../core/png');

test('menu: every page draws and the clicks work (headless preview)', (t) => {
  const r = preview.run();
  if (r.skipped) return t.skip(r.skipped);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /the switch on the first card flips the module/);
  assert.match(r.out, /the dock switches the page/);
  assert.match(r.out, /a click on a skin tile puts that skin on/);
  assert.match(r.out, /a click on a cape preset sets that cape/);
  for (const f of ['1-modules', '2-module-zoom', '3-style', '4-cosmetics', '4b-cosmetics-back', '5-settings', '6-light', '7-ocean-gradient', '9-skin-picked']) {
    assert.ok(fs.statSync(path.join(preview.outDir, `${f}.png`)).size > 3000, f);
  }
});

test('menu: skins and capes picked in the game are readable by the launcher', (t) => {
  const lib = path.join(preview.outDir, 'library');
  if (!fs.existsSync(lib)) return t.skip('the preview did not run');
  fs.cpSync(lib, path.join(home, 'skins'), { recursive: true });
  const list = skins.list();
  assert.deepEqual(list.map((s) => s.name), ['Pilot', 'Rosalind', 'Forest runner with a long name', 'Old']);
  assert.ok(list.every((s) => ['classic', 'slim'].includes(s.model)));
  const pic = png.decode(skins.read(list[0].id));
  assert.equal(pic.width, 64);
  assert.equal(pic.height, 64);
  assert.ok(skins.hasCape());
  const cape = png.decode(skins.capeBytes());
  assert.equal(cape.width, 64);
  assert.equal(cape.height, 32);
});
