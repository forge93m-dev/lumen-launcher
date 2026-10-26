const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const UA = 'LumenClient/1.0.0 (Minecraft launcher)';
const cache = new Map();

async function fetchRetry(url, opts = {}, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r;
    } catch (e) {
      err = e;
      if (/HTTP 4\d\d/.test(e.message) && !/HTTP 429/.test(e.message)) break;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw err;
}

async function getJson(url, opts) {
  const r = await fetchRetry(url, opts);
  return r.json();
}

// In-memory cache for API responses that rarely change.
async function getJsonCached(url, ttlMs = 10 * 60 * 1000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await getJson(url);
  cache.set(url, { t: Date.now(), v });
  return v;
}

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// Downloads url to dest. Skips when a file of the expected size already exists.
// Returns true if something was downloaded.
async function download(url, dest, { sha1, size } = {}) {
  try {
    const st = await fsp.stat(dest);
    if (size ? st.size === size : st.size > 0) return false;
  } catch {}
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2)}.part`;
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchRetry(url);
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
      if (sha1) {
        const got = await sha1File(tmp);
        if (got !== sha1) throw new Error(`Checksum mismatch for ${path.basename(dest)}`);
      }
      await fsp.rename(tmp, dest);
      return true;
    } catch (e) {
      err = e;
      await fsp.rm(tmp, { force: true });
    }
  }
  throw err;
}

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

// jobs: [{url, dest, sha1, size}]
async function downloadMany(jobs, text, onProgress, limit = 16) {
  let done = 0;
  const total = jobs.length;
  onProgress && onProgress({ text, done, total });
  await pool(jobs, limit, async (j) => {
    await download(j.url, j.dest, j);
    done++;
    onProgress && onProgress({ text, done, total });
  });
}

module.exports = { UA, fetchRetry, getJson, getJsonCached, download, downloadMany, pool, sha1File };
