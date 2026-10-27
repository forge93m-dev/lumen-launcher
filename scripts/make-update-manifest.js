// node scripts/make-update-manifest.js <installer file> <https url of that file> [notes]
// Prints the latest.json to upload next to the installer. The version is the one in package.json.
const fs = require('fs');
const path = require('path');
const { sha256File } = require('../core/updater');

(async () => {
  const [file, url, notes] = process.argv.slice(2);
  if (!file || !url) {
    console.error('usage: node scripts/make-update-manifest.js <installer> <https url of the installer> [notes]');
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(JSON.stringify({ version: pkg.version, url, sha256: await sha256File(file), notes: notes || '' }, null, 2));
})();
