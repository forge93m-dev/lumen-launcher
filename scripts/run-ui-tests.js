// Runs every tests/ui/*.test.js in Electron, one at a time, and reports. Usage: npm run test:ui [name-filter]
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electron = require('electron'); // path to the electron binary
const dir = path.join(__dirname, '..', 'tests', 'ui');
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js') && f.includes(filter)).sort();
let failed = 0;
for (const f of files) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electron, [path.join(dir, f)], { env, encoding: 'utf8', timeout: 600000 });
  const lines = (r.stdout || '').split(/\r?\n/).filter((l) => /^(#|PASS|FAIL|ALL PASSED|\d+ FAILED)/.test(l));
  console.log(lines.join('\n'));
  if (r.status !== 0) { failed++; if (r.error) console.log(`(${f}: ${r.error.message})`); }
}
console.log(failed ? `\n${failed} UI test file(s) failed` : `\nAll ${files.length} UI test file(s) passed`);
process.exit(failed ? 1 : 0);
