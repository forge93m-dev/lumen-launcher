// Puts the Lumen skin service on Cloudflare (a free account is enough) and builds its address into the launcher, so the
// players of your build need to do nothing. Run:  npm run deploy-skins   (the browser opens once to log in)
// Afterwards run `npm run dist` to make an installer that knows the address.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'server', 'cloudflare');
const toml = path.join(dir, 'wrangler.toml');
const PLACEHOLDER = 'REPLACE_WITH_THE_ID_FROM_THE_COMMAND_ABOVE';

// The KV namespace id in what `wrangler kv namespace create` printed.
const parseNamespaceId = (out) => (/\bid\s*=\s*"([0-9a-f]{32})"/i.exec(out) || /"id":\s*"([0-9a-f]{32})"/i.exec(out) || [])[1] || null;
// The address `wrangler deploy` printed.
const parseWorkerUrl = (out) => (/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/i.exec(out) || [])[0] || null;

function wrangler(args, { inherit = false } = {}) {
  const r = spawnSync('npx', ['--yes', 'wrangler@4', ...args], { cwd: dir, shell: true, encoding: 'utf8', stdio: inherit ? 'inherit' : ['inherit', 'pipe', 'pipe'] });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}

function main() {
  console.log('1/4 Logging in to Cloudflare (a browser window opens if you are not logged in yet)…');
  const who = wrangler(['whoami']);
  if (who.code !== 0 || /not authenticated/i.test(who.out)) {
    if (wrangler(['login'], { inherit: true }).code !== 0) throw new Error('Login did not finish');
  }
  let text = fs.readFileSync(toml, 'utf8');
  if (text.includes(PLACEHOLDER)) {
    console.log('2/4 Creating the storage (Workers KV)…');
    const r = wrangler(['kv', 'namespace', 'create', 'SKINS']);
    const id = parseNamespaceId(r.out);
    if (!id) throw new Error(`Could not read the storage id from:\n${r.out}`);
    text = text.replace(PLACEHOLDER, id);
    fs.writeFileSync(toml, text);
  } else {
    console.log('2/4 The storage is already set up.');
  }
  console.log('3/4 Uploading the service…');
  const d = wrangler(['deploy']);
  if (d.code !== 0) throw new Error(`Deploy failed:\n${d.out}`);
  const url = parseWorkerUrl(d.out);
  if (!url) throw new Error(`Deployed, but the address was not in the output:\n${d.out}`);
  console.log(`4/4 Building ${url} into the launcher (core/service.json)…`);
  fs.writeFileSync(path.join(__dirname, '..', 'core', 'service.json'), `${JSON.stringify({ skinService: url }, null, 2)}\n`);
  console.log(`\nDone. The Lumen skin service is at ${url}\nNow run "npm run dist" to make an installer that uses it; share that installer with your players.`);
}

module.exports = { parseNamespaceId, parseWorkerUrl };
if (require.main === module) {
  try { main(); } catch (e) { console.error(`\n${e.message}`); process.exit(1); }
}
