// The Cloudflare Worker version of the skin service, run in Node with an in-memory stand-in for Workers KV
// (the shared checks are in skin-suite.js).
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const { runSuite } = require('./skin-suite');

// Just the parts of Workers KV the worker uses.
class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key, type = 'text') {
    if (!this.map.has(key)) return null;
    const v = this.map.get(key);
    if (type === 'json') return JSON.parse(typeof v === 'string' ? v : Buffer.from(v).toString('utf8'));
    if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
    return typeof v === 'string' ? v : Buffer.from(v).toString('utf8');
  }
  async put(key, value) { this.map.set(key, typeof value === 'string' ? value : new Uint8Array(value)); }
  async delete(key) { this.map.delete(key); }
}

runSuite('cloudflare worker', async () => {
  const worker = (await import(pathToFileURL(path.join(__dirname, '..', '..', 'server', 'cloudflare', 'worker.mjs')).href)).default;
  const env = { SKINS: new MemoryKV(), MIN_REWRITE_MS: '0' };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const r = await worker.fetch(new Request(`http://worker.test${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
});
