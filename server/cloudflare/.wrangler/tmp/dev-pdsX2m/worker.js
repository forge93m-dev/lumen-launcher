var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.mjs
var NAME = /^[A-Za-z0-9_]{3,16}$/;
var MAX_BODY = 160 * 1024;
var MAX_PNG = 48 * 1024;
var DEFAULT_REWRITE_MS = 2e3;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var json = /* @__PURE__ */ __name((status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", ...extra } }), "json");
var b64decode = /* @__PURE__ */ __name((s) => {
  const bin = atob(String(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}, "b64decode");
async function sha256hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256hex, "sha256hex");
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
__name(sameText, "sameText");
async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
__name(inflate, "inflate");
var be32 = /* @__PURE__ */ __name((a, o) => (a[o] << 24 | a[o + 1] << 16 | a[o + 2] << 8 | a[o + 3]) >>> 0, "be32");
async function cleanPng(b64, w, h, what) {
  let raw;
  try {
    raw = b64decode(b64);
  } catch {
    throw new HttpError(400, `${what} is not base64`);
  }
  if (raw.length === 0 || raw.length > MAX_PNG) throw new HttpError(413, `${what} picture is too large`);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (raw.length < 33 || sig.some((v, i) => raw[i] !== v)) throw new HttpError(400, `${what}: this is not a PNG`);
  let pos = 8;
  let ihdr = null;
  const keep = [];
  const idat = [];
  while (pos + 12 <= raw.length) {
    const len = be32(raw, pos);
    const type = String.fromCharCode(raw[pos + 4], raw[pos + 5], raw[pos + 6], raw[pos + 7]);
    if (pos + 12 + len > raw.length) throw new HttpError(400, `${what}: the PNG is damaged`);
    const chunk = raw.subarray(pos, pos + 12 + len);
    const data = raw.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") ihdr = { width: be32(data, 0), height: be32(data, 4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === "IHDR" || type === "PLTE" || type === "tRNS") keep.push(chunk);
    if (type === "IDAT") {
      idat.push(data);
      keep.push(chunk);
    }
    if (type === "IEND") {
      keep.push(chunk);
      break;
    }
  }
  if (!ihdr || idat.length === 0) throw new HttpError(400, `${what}: the PNG is damaged`);
  if (ihdr.width !== w || ihdr.height !== h) throw new HttpError(400, `${what} must be ${w}x${h} pixels`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (ihdr.depth !== 8 || ihdr.interlace || !channels) throw new HttpError(400, `${what} must be an 8-bit PNG without interlacing`);
  let total = 0;
  for (const d of idat) total += d.length;
  const joined = new Uint8Array(total);
  let o = 0;
  for (const d of idat) {
    joined.set(d, o);
    o += d.length;
  }
  let pixels;
  try {
    pixels = await inflate(joined);
  } catch {
    throw new HttpError(400, `${what}: the PNG is damaged`);
  }
  if (pixels.length !== (w * channels + 1) * h) throw new HttpError(400, `${what}: the PNG is damaged`);
  const out = new Uint8Array(8 + keep.reduce((n, c) => n + c.length, 0));
  out.set(sig, 0);
  let p = 8;
  for (const c of keep) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
__name(cleanPng, "cleanPng");
async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "Request too large");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}
__name(readBody, "readBody");
var keyOf = /* @__PURE__ */ __name((kind, name) => `${kind}:${name.toLowerCase()}`, "keyOf");
var readMeta = /* @__PURE__ */ __name(async (env, name) => env.SKINS.get(keyOf("p", name), "json"), "readMeta");
var publicProfile = /* @__PURE__ */ __name((m) => ({
  name: m.name,
  slim: !!m.slim,
  rev: m.rev,
  skin: m.hasSkin ? `/v1/skin/${m.name}` : null,
  cape: m.hasCape ? `/v1/cape/${m.name}` : null
}), "publicProfile");
async function checkToken(meta, token) {
  if (typeof token !== "string" || token.length < 16) throw new HttpError(401, "A secret token of at least 16 characters is required");
  if (!sameText(meta.tokenHash, await sha256hex(token))) throw new HttpError(403, "This name belongs to another launcher");
}
__name(checkToken, "checkToken");
async function put(env, name, body) {
  if (!NAME.test(name)) throw new HttpError(400, "A nickname is 3\u201316 letters, digits or _");
  let meta = await readMeta(env, name);
  const skin = body.skin === void 0 ? void 0 : body.skin === null ? null : await cleanPng(body.skin, 64, 64, "The skin");
  const cape = body.cape === void 0 ? void 0 : body.cape === null ? null : await cleanPng(body.cape, 64, 32, "The cape");
  if (meta) {
    await checkToken(meta, body.token);
    if (Date.now() - (meta.updated || 0) < Number(env.MIN_REWRITE_MS ?? DEFAULT_REWRITE_MS)) throw new HttpError(429, "Slow down");
  } else {
    if (typeof body.token !== "string" || body.token.length < 16) throw new HttpError(401, "A secret token of at least 16 characters is required");
    meta = { name, tokenHash: await sha256hex(body.token), slim: false, rev: 0, hasSkin: false, hasCape: false };
    const count = Number(await env.SKINS.get("meta:count") || 0);
    await env.SKINS.put("meta:count", String(count + 1));
  }
  if (skin) {
    await env.SKINS.put(keyOf("s", name), skin);
    meta.hasSkin = true;
  }
  if (skin === null) {
    await env.SKINS.delete(keyOf("s", name));
    meta.hasSkin = false;
  }
  if (cape) {
    await env.SKINS.put(keyOf("c", name), cape);
    meta.hasCape = true;
  }
  if (cape === null) {
    await env.SKINS.delete(keyOf("c", name));
    meta.hasCape = false;
  }
  if (body.slim !== void 0) meta.slim = !!body.slim;
  meta.name = name;
  meta.rev = (meta.rev || 0) + 1;
  meta.updated = Date.now();
  await env.SKINS.put(keyOf("p", name), JSON.stringify(meta));
  return publicProfile(meta);
}
__name(put, "put");
async function handle(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1") throw new HttpError(404, "Not found");
  if (parts[1] === "health") return json(200, { ok: true, service: "lumen-skins", profiles: Number(await env.SKINS.get("meta:count") || 0) });
  if (parts[1] === "lookup" && request.method === "POST") {
    const body = await readBody(request);
    const names = Array.isArray(body.names) ? body.names.slice(0, 64) : [];
    const profiles = {};
    await Promise.all(names.map(async (n) => {
      if (typeof n !== "string" || !NAME.test(n)) return;
      const m = await readMeta(env, n);
      if (m && (m.hasSkin || m.hasCape)) profiles[n] = publicProfile(m);
    }));
    return json(200, { profiles });
  }
  const name = parts[2];
  if (!name || !NAME.test(name)) throw new HttpError(400, "A nickname is 3\u201316 letters, digits or _");
  if (parts[1] === "profile") {
    if (request.method === "GET") {
      const m = await readMeta(env, name);
      if (!m) throw new HttpError(404, "No such player");
      return json(200, publicProfile(m));
    }
    if (request.method === "PUT") return json(200, await put(env, name, await readBody(request)));
    if (request.method === "DELETE") {
      const m = await readMeta(env, name);
      if (!m) throw new HttpError(404, "No such player");
      await checkToken(m, (await readBody(request)).token);
      await Promise.all([env.SKINS.delete(keyOf("p", name)), env.SKINS.delete(keyOf("s", name)), env.SKINS.delete(keyOf("c", name))]);
      const count = Number(await env.SKINS.get("meta:count") || 0);
      await env.SKINS.put("meta:count", String(Math.max(0, count - 1)));
      return json(200, { ok: true });
    }
  }
  if ((parts[1] === "skin" || parts[1] === "cape") && request.method === "GET") {
    const bytes = await env.SKINS.get(keyOf(parts[1] === "skin" ? "s" : "c", name), "arrayBuffer");
    if (!bytes) throw new HttpError(404, "No such picture");
    return new Response(bytes, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  }
  throw new HttpError(404, "Not found");
}
__name(handle, "handle");
var worker_default = {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: "Something went wrong" });
    }
  }
};

// ../../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-CYUxWR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-CYUxWR/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
