// The same checks against a Worker that is really running (workerd): `npx wrangler dev --local` in server/cloudflare, then
//   LUMEN_WORKER_URL=http://127.0.0.1:8799 node --test tests/net/skin-worker-live.test.js
// Skipped when LUMEN_WORKER_URL is not set. Note: a live Worker keeps its data between runs and limits rewrites per name.
const { runSuite } = require('./skin-suite');

if (process.env.LUMEN_WORKER_URL) {
  runSuite('live worker', async () => ({ base: process.env.LUMEN_WORKER_URL.replace(/\/+$/, ''), close() {} }));
}
