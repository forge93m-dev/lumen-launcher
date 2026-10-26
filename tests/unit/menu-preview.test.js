// The in-game menu runs headless (no Minecraft, no window): it must draw all its pages and answer clicks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const preview = require('../../scripts/preview-menu');

test('menu: every page draws and the clicks work (headless preview)', (t) => {
  const r = preview.run();
  if (r.skipped) return t.skip(r.skipped);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /the switch on the first card flips the module/);
  assert.match(r.out, /the dock switches the page/);
  for (const f of ['1-modules', '2-module-zoom', '3-style', '4-cosmetics', '5-settings', '6-light', '7-ocean-gradient']) {
    assert.ok(fs.statSync(path.join(preview.outDir, `${f}.png`)).size > 3000, f);
  }
});
