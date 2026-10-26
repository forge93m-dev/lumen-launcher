'use strict';
const api = window.lumen;

const S = {
  cfg: null,
  sys: null,
  instances: [],
  view: 'home',
  game: { state: 'idle' },
  progress: null,
  logs: [],
  unread: 0,
  news: null,
  modules: null,
  moduleCat: 'All',
  moduleQuery: '',
  versions: {},
  fabricVersions: null,
  browse: { type: 'mod', query: '', sort: 'relevance', hits: [], offset: 0, total: 0, loading: false, key: '' },
  contentTab: 'mod',
  updates: null,
  busy: new Set(),
  tasks: [],
  serverStatus: {},
};

// ---------------- helpers ----------------
// DOM id for a server card; btoa() throws on non-Latin addresses (IDN hosts), so hex-encode instead.
const srvId = (addr) => `srv-${[...new TextEncoder().encode(addr)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));
const fmtTime = (s) => { s = s || 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
const ago = (t) => {
  if (!t) return 'never';
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};
const fileUrl = (p) => `file:///${encodeURI(p.replace(/\\/g, '/'))}`;
const avatar = (name) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
const cur = () => S.instances.find((i) => i.id === S.cfg.selectedInstance) || S.instances[0] || null;
const account = () => S.cfg.accounts.find((a) => a.id === S.cfg.selectedAccount) || null;
const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#ef4444'];
const instColor = (i) => i.color || COLORS[[...i.id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const instIcon = (i, size = 48) => `<div class="inst-icon" style="width:${size}px;height:${size}px;background:linear-gradient(135deg, ${instColor(i)}, color-mix(in srgb, ${instColor(i)} 45%, #000))">${esc(i.name.trim()[0] || '?').toUpperCase()}</div>`;
const loaderLabel = (l) => (l === 'fabric' ? 'Fabric' : 'Vanilla');
const TYPE_LABEL = { mod: 'Mods', resourcepack: 'Resource Packs', shader: 'Shaders' };

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

function toast(msg, kind = '') {
  // Repeating the same message (e.g. spamming a button) must not stack copies or replay the pop-in.
  const same = [...document.querySelectorAll('#toasts .toast')].find((t) => t.dataset.msg === msg);
  if (same) {
    clearTimeout(same._timer);
    same.style.opacity = '';
    same._timer = setTimeout(same._dismiss, kind === 'err' ? 6000 : 3200);
    return;
  }
  const el = document.createElement('div');
  el.dataset.msg = msg;
  el.className = `toast ${kind}`;
  el.innerHTML = `${kind === 'err' ? ic('x') : kind === 'ok' ? ic('check') : ''}<span>${esc(msg)}</span>`;
  el.querySelector('svg') && (el.querySelector('svg').style.cssText = 'width:16px;height:16px;flex:none');
  $('#toasts').appendChild(el);
  el._dismiss = () => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); };
  el._timer = setTimeout(el._dismiss, kind === 'err' ? 6000 : 3200);
}

function modal(html, { wide, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => e.key === 'Escape' && close();
  // The click that opened the modal may be repeated (double-click, spam) and then lands on the backdrop;
  // without this grace period that closes the modal again and it flickers open and shut.
  const openedAt = Date.now();
  wrap.addEventListener('mousedown', (e) => e.target === wrap && Date.now() - openedAt > 500 && close());
  document.addEventListener('keydown', onKey);
  $('#modal-root').appendChild(wrap);
  wrap.close = close;
  return wrap;
}

function confirmBox(title, text, ok = 'Delete') {
  return new Promise((resolve) => {
    const m = modal(`<h2>${esc(title)}</h2><p class="sub">${esc(text)}</p>
      <div class="foot"><button class="btn ghost" data-r="0">Cancel</button><button class="btn primary" data-r="1">${esc(ok)}</button></div>`);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) { m.close(); resolve(b.dataset.r === '1'); }
    });
  });
}

async function runTask(label, fn) {
  const t = { id: Math.random(), label, status: '' };
  S.tasks.push(t);
  renderDock();
  try {
    return await fn(t);
  } finally {
    S.tasks = S.tasks.filter((x) => x !== t);
    renderDock();
  }
}

async function refreshInstances() {
  S.instances = await api.call('instances:list');
}

async function saveCfg(patch) {
  S.cfg = await api.call('config:set', patch);
}

function applyAccent() {
  document.documentElement.style.setProperty('--accent', S.cfg.settings.accent || '#8b5cf6');
}

// ---------------- navigation ----------------
const NAV = [
  ['home', 'Home', 'home'],
  ['instances', 'Instances', 'layers'],
  ['modules', 'Client Modules', 'zap'],
  ['hud', 'HUD Editor', 'layout'],
  ['browse', 'Browse', 'compass'],
  ['modpacks', 'Modpacks', 'gift'],
  ['content', 'Installed', 'package'],
  null,
  ['servers', 'Servers', 'server'],
  ['screenshots', 'Screenshots', 'image'],
  ['console', 'Console', 'terminal'],
  ['settings', 'Settings', 'settings'],
];

function renderNav() {
  $('#navlist').innerHTML = NAV.map((n) => {
    if (!n) return '<div class="sep"></div>';
    const [id, label, icon] = n;
    let pill = '';
    if (id === 'console' && S.game.state === 'running') pill = '<span class="pill">LIVE</span>';
    else if (id === 'console' && S.unread) pill = `<span class="pill">${S.unread > 99 ? '99+' : S.unread}</span>`;
    else if (id === 'content' && updateCount()) pill = `<span class="pill" title="Updates available">${updateCount()}</span>`;
    return `<button class="navbtn ${S.view === id ? 'active' : ''}" data-act="nav" data-v="${id}">${ic(icon)}<span>${label}</span>${pill}</button>`;
  }).join('');
  const a = account();
  $('#account-chip').innerHTML = a
    ? `<img src="${avatar(a.name)}" alt=""><div><div class="n" data-nt>${esc(a.name)}</div><div class="t">${a.type === 'msa' ? 'Microsoft' : 'Offline account'}</div></div>`
    : `<div class="avatar" style="display:grid;place-items:center">${ic('user')}</div><div><div class="n">No account</div><div class="t">Click to add</div></div>`;
}

// ---- mod updates: checked in the background so the badge on "Installed" is there without asking ----
S.updateMap = {}; // instance id -> { t, list }, so switching instances doesn't re-query Modrinth every time
let updateCheckFor = null;
const updateCount = () => { const c = cur(); return c && S.updates && S.updates.instId === c.id ? S.updates.list.length : 0; };

function setUpdates(instId, list) {
  S.updateMap[instId] = { t: Date.now(), list };
  S.updates = { instId, list };
}

async function ensureUpdateCheck() {
  const inst = cur();
  if (!inst || updateCheckFor === inst.id || !Object.values(inst.content).some((e) => !e.builtin)) return;
  const cached = S.updateMap[inst.id];
  if (cached && Date.now() - cached.t < 10 * 60 * 1000) {
    if (!S.updates || S.updates.instId !== inst.id) { S.updates = { instId: inst.id, list: cached.list }; renderNav(); }
    return;
  }
  updateCheckFor = inst.id;
  try {
    const list = await api.call('content:updates', inst.id);
    setUpdates(inst.id, list);
    renderNav();
    if (S.view === 'content') render();
  } catch {
    S.updateMap[inst.id] = { t: Date.now(), list: [] }; // offline or rate-limited: don't retry on every render
  } finally {
    updateCheckFor = null;
  }
}

function render() {
  renderNav();
  setTimeout(ensureUpdateCheck, 0);
  const el = $('#view');
  el.innerHTML = '';
  const page = document.createElement('div');
  page.className = S.enter ? 'page enter' : 'page'; // fade in on navigation only, not on every re-render
  S.enter = false;
  el.appendChild(page);
  (VIEWS[S.view] || VIEWS.home)(page);
  renderDock();
}

function nav(v) {
  if (v === 'content' && S.view !== 'content') S.contentFilter = ''; // a leftover filter would look like missing mods
  S.enter = v !== S.view; // clicking the page you're already on shouldn't replay the transition
  S.view = v;
  if (v === 'console') S.unread = 0;
  if (v === 'hud') S.hud = null; // reload from disk: the in-game editor may have changed it since
  $('#view').scrollTop = 0;
  render();
}

function needInstance(page, what) {
  page.innerHTML = `<div class="empty">${ic('layers')}<h3>No instance yet</h3><p>Create an instance to ${what}.</p>
    <button class="btn primary" data-act="new-instance">${ic('plus')}New instance</button></div>`;
}

function instBar(inst) {
  return `<button class="inst-picker" data-act="pick-instance" style="height:44px;min-width:220px">${instIcon(inst, 28)}
    <div class="grow"><div class="n" data-nt>${esc(inst.name)}</div><div class="v">${esc(inst.version)} · ${loaderLabel(inst.loader)}</div></div>${ic('chevron').replace('<svg', '<svg style="width:16px;height:16px;color:var(--muted)"')}</button>`;
}

// ---------------- dock ----------------
let dockSeen = new Set();
function renderDock() {
  // Cards that were already on screen must not replay their pop-in animation on every update.
  const cards = S.tasks.map((t) => ({ key: `t${t.id}`, html: `<div class="grow"><div style="font-weight:600">${esc(t.label)}</div>${t.status ? `<div class="small muted">${esc(t.status)}</div>` : ''}</div>`, spin: true }));
  if (S.game.state === 'preparing' && S.view !== 'home') cards.unshift({ key: 'game', html: progressHtml(), column: true });
  $('#dock').innerHTML = cards.map((c) => `<div class="task ${dockSeen.has(c.key) ? '' : 'enter'}"${c.column ? ' style="flex-direction:column;align-items:stretch"' : ''}>${c.spin ? '<span class="spinner"></span>' : ''}${c.html}</div>`).join('');
  dockSeen = new Set(cards.map((c) => c.key));
}

// Updates the progress bar in place so its width animates and the indeterminate sweep doesn't restart.
function paintProgress() {
  const p = S.progress || { text: 'Preparing…' };
  const pct = p.total ? Math.round((p.done / p.total) * 100) : null;
  document.querySelectorAll('.progress').forEach((box) => {
    const [label, count] = box.querySelectorAll('.txt span');
    label.textContent = p.text || 'Preparing…';
    count.textContent = pct !== null ? `${p.done}/${p.total} · ${pct}%` : '';
    box.querySelector('.bar').classList.toggle('indet', pct === null);
    box.querySelector('.bar i').style.width = `${pct || 0}%`;
  });
}

function progressHtml() {
  if (S.game.state !== 'preparing') return '';
  const p = S.progress || { text: 'Preparing…' };
  const pct = p.total ? Math.round((p.done / p.total) * 100) : null;
  return `<div class="progress" style="margin-top:${S.view === 'home' ? 18 : 0}px">
    <div class="txt"><span>${esc(p.text || 'Preparing…')}</span><span>${pct !== null ? `${p.done}/${p.total} · ${pct}%` : ''}</span></div>
    <div class="bar ${pct === null ? 'indet' : ''}"><i style="width:${pct || 0}%"></i></div></div>`;
}

// ---------------- launching ----------------
let launchBusy = false; // spamming Play must not start two checks/launches
async function launch(instId, server, opts = {}) {
  if (!account()) return welcome();
  if (launchBusy || S.game.state !== 'idle') return toast('A game is already running');
  // Mods install in the background; starting now would launch with half of them and Fabric would report missing dependencies.
  if (S.tasks.length) return toast('Mods are still installing — wait for the task in the corner to finish', 'err');
  launchBusy = true;
  try {
    if (!opts.skipDoctor) {
      // Catch deleted jars and missing dependencies now, instead of a Fabric error window after a long start-up.
      const pf = await api.call('doctor:preflight', instId).catch(() => null);
      if (pf && (pf.missingFiles.length || pf.missingDeps.length)) return doctorBefore(instId, server, pf);
    }
    S.cfg.selectedInstance = instId;
    saveCfg({ selectedInstance: instId });
    S.game = { state: 'preparing', instId };
    S.progress = { text: 'Preparing…' };
    render();
    try {
      await api.call('game:launch', instId, server);
    } catch (e) {
      toast(e.message, 'err');
      // Failures that happen before the main process reports a state would leave the UI stuck on "Launching".
      S.game = await api.call('game:state').catch(() => ({ state: 'idle' }));
      render();
    }
  } finally {
    launchBusy = false;
  }
}

// ---------------- launch doctor ----------------
const docRows = (rows) => `<ul class="doc-list">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;

function doctorBefore(instId, server, pf) {
  const rows = [
    ...pf.missingFiles.map((f) => `<b>${esc(f.title)}</b> <span class="muted">— ${esc(f.file)} is missing and will be downloaded again</span>`),
    ...pf.missingDeps.map((d) => `<b>${esc(d.title)}</b> <span class="muted">— required by ${esc(d.needBy.join(', '))}, will be installed</span>`),
  ];
  const m = modal(`<h2>Fix before playing?</h2><p class="sub">The game would not start with the mods as they are now.</p>${docRows(rows)}
    <div class="foot"><button class="btn ghost" data-r="cancel">Cancel</button><button class="btn" data-r="anyway">Play anyway</button><button class="btn primary" data-r="fix">${ic('check')}Fix & play</button></div>`);
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    m.close();
    if (b.dataset.r === 'anyway') return launch(instId, server, { skipDoctor: true });
    if (b.dataset.r !== 'fix') return;
    try {
      await runTask('Fixing mods', () => api.call('doctor:fix', instId, { reinstall: pf.missingFiles.map((f) => f.id), install: pf.missingDeps.map((d) => d.id) }));
      await refreshInstances();
      launch(instId, server, { skipDoctor: true });
    } catch (err) {
      toast(`Could not fix: ${err.message}`, 'err');
    }
  });
}

// Fabric refused to start; resolve the missing mod ids to Modrinth projects and offer to install them.
async function doctorAfter(p) {
  let found = { projects: [], unknown: p.ids };
  if (p.ids.length) found = await api.call('doctor:resolve', p.instId, p.ids).catch(() => found);
  const rows = [
    ...p.details.map((d) => `<span class="muted" data-nt>${esc(d)}</span>`),
    ...found.projects.map((x) => `${x.action === 'enable' ? 'Will switch on' : x.action === 'reinstall' ? 'Will download again' : 'Can install'}: <b>${esc(x.title)}</b>`),
    ...found.unknown.map((id) => `Not found on Modrinth, install manually: <b>${esc(id)}</b>`),
    ...p.other.map((o) => `<span data-nt>${esc(o)}</span>`),
  ];
  const canFix = found.projects.length > 0;
  const m = modal(`<h2>A mod is missing</h2><p class="sub">Fabric could not start the game. The game was closed.</p>${docRows(rows.length ? rows : ['See the Console for details.'])}
    <div class="foot"><button class="btn ghost" data-r="close">Close</button>${canFix ? `<button class="btn primary" data-r="fix">${ic('download')}Install & play again</button>` : ''}</div>`);
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    m.close();
    if (b.dataset.r !== 'fix') return;
    try {
      await runTask('Installing missing mods', () => api.call('doctor:fix', p.instId, { install: found.projects.map((x) => x.id) }));
      await refreshInstances();
      launch(p.instId, undefined);
    } catch (err) {
      toast(`Could not install: ${err.message}`, 'err');
    }
  });
}

// Suggested memory after an out-of-memory crash: noticeably more, but always leaving the OS some room.
// Memory that suits an instance with `mods` mods: enough to avoid stutter, never starving the rest of the PC.
const recommendRam = (mods, systemRam) => {
  const want = mods <= 5 ? 2048 : mods <= 40 ? 4096 : mods <= 120 ? 6144 : 8192;
  const cap = Math.floor((systemRam - 3072) / 512) * 512; // leave the OS and launcher 3 GB
  return Math.max(2048, Math.min(want, cap));
};

const raisedRam = (ram, systemRam) => {
  const want = Math.max(Math.ceil((ram * 1.5) / 512) * 512, ram + 1024);
  return Math.min(want, Math.floor((systemRam - 2048) / 512) * 512);
};

function oomModal(p) {
  const next = raisedRam(p.ram, p.systemRam);
  const canRaise = next > p.ram;
  const gb = (mb) => `${(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB`;
  const m = modal(`<h2>Minecraft ran out of memory</h2>
    <p class="sub">It was given ${gb(p.ram)} and needed more${Object.keys(S.instances.find((i) => i.id === p.instId)?.content || {}).length > 20 ? ', which is common with this many mods' : ''}.${canRaise ? '' : ` Your computer only has ${gb(p.systemRam)} in total, so there is no safe way to give it more. Removing some mods will help.`}</p>
    <div class="foot"><button class="btn ghost" data-r="close">Close</button>${canRaise ? `<button class="btn primary" data-r="raise">${ic('check')}Give it ${gb(next)} & play again</button>` : ''}</div>`);
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    m.close();
    if (b.dataset.r !== 'raise') return;
    try {
      await api.call('game:kill'); // it may still be running in a broken state
      await api.call('instances:update', p.instId, { ram: next });
      await refreshInstances();
      for (let i = 0; i < 20 && S.game.state !== 'idle'; i++) await new Promise((r) => setTimeout(r, 250));
      launch(p.instId, undefined);
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

function crashModal(c) {
  const m = modal(`<h2>The game crashed</h2><p class="sub"${c.description ? ' data-nt' : ''}>${esc(c.description || 'Minecraft stopped unexpectedly.')}</p>
    <p class="small dim" data-nt style="word-break:break-all">${esc(c.name)}</p>
    <div class="foot"><button class="btn ghost" data-r="close">Close</button><button class="btn" data-r="console">Show console</button><button class="btn primary" data-r="open">${ic('file')}Open crash report</button></div>`);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    m.close();
    if (b.dataset.r === 'open') api.call('doctor:openFile', c.file).catch((err) => toast(err.message, 'err'));
    if (b.dataset.r === 'console') nav('console');
  });
}

// ---------------- views ----------------
const VIEWS = {};

VIEWS.home = (page) => {
  const inst = cur();
  const acc = account();
  const g = S.game;
  const bg = S.news && S.news[0] && S.news[0].image;
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  let play;
  if (!inst) play = `<button class="play" data-act="new-instance">${ic('plus')}CREATE</button>`;
  else if (g.state === 'running') play = `<button class="play stop" data-act="kill">${ic('stop')}STOP</button>`;
  else if (g.state === 'preparing') play = `<button class="play busy"><span class="spinner" style="border-top-color:#fff"></span>LAUNCHING</button>`;
  else play = `<button class="play" data-act="play" data-id="${inst.id}">${ic('play')}PLAY</button>`;

  const mods = inst ? Object.values(inst.content).filter((e) => e.type === 'mod' && e.enabled !== false).length : 0;
  const total = S.instances.reduce((a, i) => a + (i.playtime || 0), 0);

  page.innerHTML = `
    <div class="hero">
      <div class="hero-bg" style="background-image:url('${esc(bg || '')}')"></div>
      <div class="hero-body">
        <div class="hero-kicker">${greet}, ${esc(acc ? acc.name : 'player')}</div>
        <h1${inst ? ' data-nt' : ''}>${inst ? esc(inst.name) : 'Welcome to Lumen'}</h1>
        <div class="meta">${inst
          ? `<span class="badge accent">${esc(inst.version)}</span><span class="badge">${loaderLabel(inst.loader)}</span><span class="badge">${mods} modules active</span><span class="small">Last played ${ago(inst.lastPlayed)}</span>`
          : 'Create an instance, toggle modules and jump in.'}</div>
        <div class="play-row">${play}${inst ? instBar(inst).replace('height:44px', 'height:56px') : ''}</div>
        <div id="progress">${progressHtml()}</div>
      </div>
    </div>
    <div class="stats">
      <div class="card stat"><div class="k">Instances</div><div class="v">${S.instances.length}</div></div>
      <div class="card stat"><div class="k">Active modules</div><div class="v">${mods}</div></div>
      <div class="card stat"><div class="k">Total playtime</div><div class="v">${fmtTime(total)}</div></div>
      <div class="card stat"><div class="k">This instance</div><div class="v">${inst ? fmtTime(inst.playtime) : '—'}</div></div>
    </div>
    <h2 class="section">Quick join<span class="line"></span><button class="btn sm ghost" data-act="nav" data-v="servers">All servers</button></h2>
    <div class="servers">${S.cfg.servers.slice(0, 2).map((s) => serverCard(s)).join('') || '<div class="muted">No servers saved.</div>'}</div>
    <h2 class="section">Minecraft news<span class="line"></span></h2>
    <div class="news" id="news">${newsHtml()}</div>`;
  pingServers(S.cfg.servers.slice(0, 2));
  if (!S.news) {
    api.call('news:get').then((n) => { S.news = n; if (S.view === 'home') render(); }).catch(() => { S.news = []; const el = $('#news'); if (el) el.innerHTML = '<div class="muted">News unavailable offline.</div>'; });
  }
};

function newsHtml() {
  if (!S.news) return '<div class="loading"><span class="spinner"></span></div>';
  return S.news.slice(0, 8).map((n) => `
    <div class="card news-card">
      <div class="img" style="background-image:url('${esc(n.image || '')}')"></div>
      <div class="b"><span class="badge ${n.type === 'release' ? 'accent' : ''}">${esc(n.type === 'release' ? 'Release' : 'Snapshot')} ${esc(n.version)}</span>
      <h4>${esc(n.title)}</h4><p>${esc(n.text)}</p></div>
    </div>`).join('');
}

VIEWS.instances = (page) => {
  const sel = cur();
  page.innerHTML = `
    <div class="page-head"><div><h1>Instances</h1><p>Separate game folders, each with its own version, modules and worlds.</p></div>
      <div class="row"><button class="btn" data-act="pack-import">${ic('download')}Import .mrpack</button><button class="btn primary" data-act="new-instance">${ic('plus')}New instance</button></div></div>
    <div class="grid">
      ${S.instances.map((i) => {
        const mods = Object.values(i.content).filter((e) => e.type === 'mod').length;
        const isRunning = S.game.instId === i.id && S.game.state !== 'idle';
        return `<div class="card inst-card ${sel && sel.id === i.id ? 'selected' : ''}">
          <div class="row">${instIcon(i)}<div style="min-width:0" class="grow"><h3 data-nt>${esc(i.name)}</h3>
            <div class="row" style="gap:6px;margin-top:4px"><span class="badge accent">${esc(i.version)}</span><span class="badge">${loaderLabel(i.loader)}</span>${isRunning ? '<span class="badge ok">● Running</span>' : ''}</div></div></div>
          <div class="row small muted" style="gap:14px"><span>${mods} mods</span><span>${fmtTime(i.playtime)} played</span><span>${ago(i.lastPlayed)}</span></div>
          <div class="actions">
            <button class="btn sm primary grow" data-act="play" data-id="${i.id}" ${S.game.state !== 'idle' ? 'disabled' : ''}>${ic('play')}Play</button>
            ${sel && sel.id === i.id ? '' : `<button class="btn sm" data-act="select-instance" data-id="${i.id}">Select</button>`}
          </div>
          <div class="actions tools">
            <button class="btn sm icon" title="Edit" data-act="edit-instance" data-id="${i.id}">${ic('edit')}</button>
            <button class="btn sm icon" title="Duplicate" data-act="duplicate-instance" data-id="${i.id}">${ic('copy')}</button>
            <button class="btn sm icon" title="Open folder" data-act="open-instance" data-id="${i.id}">${ic('folder')}</button>
            <button class="btn sm icon" title="Export as .mrpack" data-act="export-pack" data-id="${i.id}">${ic('up')}</button>
            <span class="grow"></span>
            <button class="btn sm icon danger" title="Delete" data-act="delete-instance" data-id="${i.id}">${ic('trash')}</button>
          </div></div>`;
      }).join('')}
      <button class="new-card" data-act="new-instance"><div style="display:grid;place-items:center;gap:6px">${ic('plus')}New instance</div></button>
    </div>`;
};

VIEWS.modules = async (page) => {
  const inst = cur();
  if (!inst) return needInstance(page, 'use client modules');
  if (!S.modules) {
    page.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    try { S.modules = await api.call('modules:list'); } catch (e) { page.innerHTML = `<div class="empty"><h3>Could not load modules</h3><p>${esc(e.message)}</p></div>`; return; }
    if (S.view !== 'modules') return;
  }
  const cats = ['All', ...new Set(S.modules.map((m) => m.cat))];
  const q = S.moduleQuery.toLowerCase();
  const list = S.modules.filter((m) => (S.moduleCat === 'All' || m.cat === S.moduleCat) && (!q || `${m.name} ${m.desc}`.toLowerCase().includes(q)));
  const isOn = (m) => m.id && inst.content[m.id];
  // Lumen HUD covers whole version families (26.1.x, 26.2.x...), so it can't use the exact-match list.
  const avail = (m) => (m.builtin ? hudSupports(inst.version) : !m.gameVersions || (m.gameVersions.includes(inst.version) && m.loaders.includes('fabric')));
  const active = S.modules.filter(isOn).length;

  page.innerHTML = `
    <div class="page-head"><div><h1>Client Modules</h1><p>${active} of ${S.modules.length} active · one click to install, with dependencies resolved automatically.</p></div>
      <div class="row">${instBar(inst)}<button class="btn primary" data-act="enable-preset" ${inst.loader !== 'fabric' ? 'disabled' : ''}>${ic('zap')}Enable essentials</button></div></div>
    ${inst.loader !== 'fabric' ? `<div class="banner">${ic('info')}<div class="grow"><b>Modules run on Fabric.</b><div class="small muted">This instance is vanilla. Switch it to Fabric to enable modules — your worlds stay untouched.</div></div><button class="btn primary sm" data-act="to-fabric">Switch to Fabric</button></div>` : ''}
    <div class="row" style="margin-bottom:16px">
      <div class="search" style="max-width:300px">${ic('search')}<input class="input" id="mod-q" placeholder="Filter modules" value="${esc(S.moduleQuery)}"></div>
      <div class="mod-cats">${cats.map((c) => `<button class="chip ${S.moduleCat === c ? 'on' : ''}" data-act="module-cat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    </div>
    <div class="modules">${list.map((m) => {
      const on = !!isOn(m);
      const ok = avail(m);
      const busy = S.busy.has(m.slug);
      return `<div class="card module ${on ? 'on' : ''} ${!ok && !on ? 'na' : ''}">
        ${m.icon ? `<img src="${esc(m.icon)}" alt="">` : '<div class="ph"></div>'}
        <div class="body"><h4>${esc(m.name)}${m.builtin ? '<span class="badge accent" style="font-size:10px;padding:0 6px">Lumen</span>' : m.preset ? '<span class="badge accent" style="font-size:10px;padding:0 6px">Essential</span>' : ''}</h4>
          <p>${esc(m.desc)}</p>
          ${!ok && !on ? `<div class="small" style="color:var(--warn);margin-top:4px">Not available for ${esc(inst.version)}</div>` : ''}
          ${m.builtin && on ? `<button class="btn sm" style="margin-top:10px" data-act="nav" data-v="hud">${ic('layout')}Open HUD Editor</button>` : ''}</div>
        <button class="switch ${on ? 'on' : ''} ${busy ? 'busy' : ''}" data-act="module-toggle" data-slug="${esc(m.slug)}" ${(!ok && !on) || inst.loader !== 'fabric' ? 'disabled' : ''} title="${on ? 'Disable' : 'Enable'}"></button>
      </div>`;
    }).join('') || '<div class="muted">No modules match.</div>'}</div>`;
  const input = $('#mod-q');
  input.addEventListener('input', () => {
    S.moduleQuery = input.value;
    const pos = input.selectionStart;
    render();
    const i2 = $('#mod-q');
    i2.focus();
    i2.setSelectionRange(pos, pos);
  });
};

let searchTimer;
VIEWS.browse = (page) => {
  const inst = cur();
  if (!inst) return needInstance(page, 'browse and install content');
  const b = S.browse;
  const key = `${inst.id}|${inst.version}|${inst.loader}|${b.type}|${b.query}|${b.sort}`;
  page.innerHTML = `
    <div class="page-head"><div><h1>Browse</h1><p>Thousands of mods, resource packs and shaders from Modrinth — filtered for ${esc(inst.version)} ${loaderLabel(inst.loader)}.</p></div>${instBar(inst)}</div>
    <div class="row" style="margin-bottom:16px">
      <div class="seg">${Object.entries(TYPE_LABEL).map(([t, l]) => `<button class="${b.type === t ? 'on' : ''}" data-act="browse-type" data-t="${t}">${l}</button>`).join('')}</div>
      <div class="search">${ic('search')}<input class="input" id="browse-q" placeholder="Search ${TYPE_LABEL[b.type].toLowerCase()}…" value="${esc(b.query)}"></div>
      <select class="input" id="browse-sort" style="width:170px">
        ${[['relevance', 'Relevance'], ['downloads', 'Most downloaded'], ['follows', 'Most followed'], ['newest', 'Newest'], ['updated', 'Recently updated']].map(([v, l]) => `<option value="${v}" ${b.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    ${b.type === 'mod' && inst.loader !== 'fabric' ? `<div class="banner">${ic('info')}<div class="grow"><b>Mods need Fabric.</b><div class="small muted">Switch this instance to Fabric to install mods.</div></div><button class="btn primary sm" data-act="to-fabric">Switch to Fabric</button></div>` : ''}
    ${b.type === 'shader' && !Object.values(inst.content).some((e) => e.slug === 'iris') ? `<div class="banner">${ic('info')}<div class="grow"><b>Shaders need Iris.</b><div class="small muted">Enable the Shaders module so packs show up in-game (Video Settings → Shader Packs).</div></div><button class="btn primary sm" data-act="enable-iris" ${inst.loader !== 'fabric' ? 'disabled' : ''}>Enable Iris</button></div>` : ''}
    <div class="results" id="results"></div>
    <div id="more" style="display:flex;justify-content:center;margin-top:18px"></div>`;

  const q = $('#browse-q');
  q.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { b.query = q.value; doSearch(true); }, 350);
  });
  $('#browse-sort').addEventListener('change', (e) => { b.sort = e.target.value; doSearch(true); });

  if (b.key !== key) doSearch(true);
  else renderResults();
};

async function doSearch(reset) {
  const inst = cur();
  const b = S.browse;
  if (reset) { b.offset = 0; b.hits = []; }
  b.key = `${inst.id}|${inst.version}|${inst.loader}|${b.type}|${b.query}|${b.sort}`;
  const key = b.key;
  b.loading = true;
  renderResults();
  try {
    const r = await api.call('modrinth:search', { query: b.query, type: b.type, gameVersion: inst.version, loader: 'fabric', offset: b.offset, sort: b.sort });
    if (key !== b.key) return;
    b.hits = reset ? r.hits : [...b.hits, ...r.hits];
    b.total = r.total_hits;
  } catch (e) {
    toast(`Search failed: ${e.message}`, 'err');
  }
  b.loading = false;
  renderResults();
}

function renderResults() {
  const el = $('#results');
  if (!el) return;
  const inst = cur();
  const b = S.browse;
  el.innerHTML = b.hits.map((h) => {
    const installed = inst.content[h.project_id];
    const busy = S.busy.has(h.project_id);
    const blocked = b.type === 'mod' && inst.loader !== 'fabric';
    return `<div class="card result" data-act="project" data-id="${esc(h.project_id)}">
      ${h.icon_url ? `<img src="${esc(h.icon_url)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
      <div class="body"><h4>${esc(h.title)}</h4><div class="by">by ${esc(h.author)}</div><p>${esc(h.description)}</p>
        <div class="foot"><span>${ic('download')}${fmtNum(h.downloads)}</span><span>${ic('heart')}${fmtNum(h.follows)}</span><span class="grow"></span>
          ${installed ? `<button class="btn sm ok" data-act="nav" data-v="content">${ic('check')}Installed</button>`
            : `<button class="btn sm primary" data-act="install" data-id="${esc(h.project_id)}" ${busy || blocked ? 'disabled' : ''}>${busy ? '<span class="spinner" style="width:14px;height:14px"></span>' : ic('download')}Install</button>`}
        </div></div></div>`;
  }).join('');
  if (!b.hits.length && !b.loading) el.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic('search')}<h3>Nothing found</h3><p>Try another search or a different version.</p></div>`;
  const more = $('#more');
  if (more) {
    more.innerHTML = b.loading ? '<span class="spinner"></span>'
      : b.hits.length < b.total ? `<button class="btn" data-act="more">Load more · ${fmtNum(b.total - b.hits.length)} left</button>` : '';
  }
}

async function openProject(id) {
  const inst = cur();
  const m = modal('<div class="loading"><span class="spinner"></span></div>', { wide: true });
  try {
    const p = await api.call('modrinth:project', id);
    const isPack = p.project_type === 'modpack'; // packs become their own instance, so no instance is needed
    const installed = !isPack && inst && inst.content[p.id];
    const type = p.project_type === 'shader' ? 'shader' : p.project_type;
    m.querySelector('.modal').innerHTML = `
      <div class="row" style="align-items:flex-start;gap:16px">
        ${p.icon_url ? `<img src="${esc(p.icon_url)}" style="width:84px;height:84px;border-radius:16px">` : ''}
        <div class="grow"><h2 data-nt>${esc(p.title)}</h2><p class="sub" data-nt style="margin-bottom:8px">${esc(p.description)}</p>
          <div class="row wrap" style="gap:6px">${p.categories.map((c) => `<span class="badge" data-nt>${esc(c)}</span>`).join('')}
          <span class="badge accent">${ic('download').replace('<svg', '<svg style="width:12px;height:12px"')} ${fmtNum(p.downloads)}</span></div></div>
        <button class="btn ghost icon" data-close>${ic('x')}</button>
      </div>
      ${p.gallery && p.gallery.length ? `<div class="gallery">${p.gallery.slice(0, 6).map((g) => `<img src="${esc(g.url)}" alt="${esc(g.title || '')}" loading="lazy">`).join('')}</div>` : '<div style="height:16px"></div>'}
      <div class="small muted">Supports ${esc(p.loaders.join(', '))} · ${esc((p.game_versions || []).slice(-1)[0] || '')} latest · ${esc(p.license ? p.license.id : '')}</div>
      <div class="foot">
        <button class="btn ghost" data-ext="https://modrinth.com/${esc(p.project_type)}/${esc(p.slug)}">${ic('external')}Modrinth page</button>
        ${isPack ? `<button class="btn primary" data-pack>${ic('download')}Install as new instance</button>`
          : installed ? `<button class="btn ok" disabled>${ic('check')}Installed</button>` : `<button class="btn primary" data-install>${ic('download')}Install to ${esc(inst.name)}</button>`}
      </div>`;
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) m.close();
      const ext = e.target.closest('[data-ext]');
      if (ext) api.call('shell:external', ext.dataset.ext);
      if (e.target.closest('[data-install]')) { m.close(); installProject(p.id, type); }
      if (e.target.closest('[data-pack]')) { m.close(); installPack(p.id); }
    });
  } catch (e) {
    m.close();
    toast(e.message, 'err');
  }
}

async function installProject(id, type, module) {
  const inst = cur();
  if (S.busy.has(id)) return;
  S.busy.add(id);
  if (S.view === 'browse') renderResults();
  try {
    const r = await runTask('Installing', () => api.call('content:install', inst.id, id, type, module));
    await refreshInstances();
    toast(`Installed ${r.installed.join(', ')}`, 'ok');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    S.busy.delete(id);
    if (S.view === 'browse') renderResults();
    else if (['modules', 'content'].includes(S.view)) render();
  }
}

// ---------------- modpacks ----------------
const PACK_SORTS = [['downloads', 'Most downloaded'], ['relevance', 'Relevance'], ['follows', 'Most followed'], ['newest', 'Newest'], ['updated', 'Recently updated']];
let packTimer;

VIEWS.modpacks = (page) => {
  const k = (S.packs = S.packs || { query: '', sort: 'downloads', hits: [], offset: 0, total: 0, loading: false, loaded: false, key: '' });
  page.innerHTML = `
    <div class="page-head"><div><h1>Modpacks</h1><p>Ready-made Fabric packs from Modrinth. Every pack installs as its own instance, so your other worlds stay untouched.</p></div>
      <button class="btn" data-act="pack-import">${ic('download')}Import .mrpack</button></div>
    <div class="row" style="margin-bottom:16px">
      <div class="search">${ic('search')}<input class="input" id="pack-q" placeholder="Search modpacks…" value="${esc(k.query)}"></div>
      <select class="input" id="pack-sort" style="width:170px">${PACK_SORTS.map(([v, l]) => `<option value="${v}" ${k.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="results" id="pack-results"></div>
    <div id="pack-more" style="display:flex;justify-content:center;margin-top:18px"></div>`;
  const q = $('#pack-q');
  q.addEventListener('input', () => { clearTimeout(packTimer); packTimer = setTimeout(() => { k.query = q.value; searchPacks(true); }, 350); });
  $('#pack-sort').addEventListener('change', (e) => { k.sort = e.target.value; searchPacks(true); });
  if (k.loaded) renderPackResults();
  else searchPacks(true);
};

async function searchPacks(reset) {
  const k = S.packs;
  if (reset) { k.offset = 0; k.hits = []; }
  const key = `${k.query}|${k.sort}`;
  k.key = key;
  k.loading = true;
  renderPackResults();
  try {
    const r = await api.call('modrinth:search', { query: k.query, type: 'modpack', loader: 'fabric', offset: k.offset, sort: k.sort });
    if (key !== k.key) return;
    k.hits = reset ? r.hits : [...k.hits, ...r.hits];
    k.total = r.total_hits;
    k.loaded = true;
  } catch (e) {
    toast(`Search failed: ${e.message}`, 'err');
  }
  k.loading = false;
  renderPackResults();
}

function renderPackResults() {
  const el = $('#pack-results');
  if (!el) return;
  const k = S.packs;
  el.innerHTML = k.hits.map((h) => {
    const busy = S.busy.has(h.project_id);
    return `<div class="card result" data-act="project" data-id="${esc(h.project_id)}">
      ${h.icon_url ? `<img src="${esc(h.icon_url)}" alt="" loading="lazy">` : '<div class="ph"></div>'}
      <div class="body"><h4>${esc(h.title)}</h4><div class="by">by ${esc(h.author)}</div><p>${esc(h.description)}</p>
        <div class="foot"><span>${ic('download')}${fmtNum(h.downloads)}</span><span>${ic('heart')}${fmtNum(h.follows)}</span><span class="grow"></span>
          <button class="btn sm primary" data-act="pack-install" data-id="${esc(h.project_id)}" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner" style="width:14px;height:14px"></span>' : ic('download')}Install</button>
        </div></div></div>`;
  }).join('');
  if (!k.hits.length && !k.loading) el.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic('search')}<h3>No modpacks found</h3><p>Try another search.</p></div>`;
  const more = $('#pack-more');
  if (more) more.innerHTML = k.loading ? '<span class="spinner"></span>' : k.hits.length < k.total ? `<button class="btn" data-act="pack-more">Load more · ${fmtNum(k.total - k.hits.length)} left</button>` : '';
}

// A freshly created instance becomes the selected one and the page shows it.
async function adoptInstance(inst, verb) {
  await refreshInstances();
  await saveCfg({ selectedInstance: inst.id });
  S.updates = null;
  toast(`${verb} ${inst.name} (${inst.version}${inst.loader === 'fabric' ? ' Fabric' : ''})`, 'ok');
  nav('instances');
}

async function installPack(id) {
  if (S.busy.has(id)) return;
  S.busy.add(id);
  if (S.view === 'modpacks') renderPackResults();
  try {
    adoptInstance(await runTask('Installing modpack', () => api.call('pack:install', id)), 'Installed');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    S.busy.delete(id);
    if (S.view === 'modpacks') renderPackResults();
  }
}

// Builds the Installed page markup. Kept separate so the page can be painted from cache while fresh data loads.
function contentHtml(inst, data) {
  const t = S.contentTab;
  // "Use" switches a resource pack / shader pack on in the game itself (options.txt / Iris config).
  const act = data.active || {};
  const useBtn = (type, file, enabled) => {
    if (type === 'mod' || enabled === false) return '';
    const on = type === 'shader' ? act.shader === file : (act.resourcepacks || []).includes(file);
    return `<button class="btn sm ${on ? 'ok' : ''}" data-act="pack-use" data-type="${type}" data-file="${esc(file)}" data-on="${on ? '0' : '1'}" title="${on ? 'Click to switch off' : 'Switch on in the game'}">${on ? `${ic('check')}Active` : 'Use'}</button>`;
  };
  const hasIris = Object.values(inst.content).some((e) => e.slug === 'iris' && e.enabled !== false);
  const q = (S.contentFilter || '').trim().toLowerCase();
  const matches = (e) => !q || `${e.title} ${e.file}`.toLowerCase().includes(q);
  const tracked = data.tracked.filter((e) => e.type === t && matches(e)).sort((a, b) => a.title.localeCompare(b.title));
  const local = data.local.filter((e) => e.type === t && matches(e));
  // Which enabled mods depend on each entry, so "why is this here?" has an answer before the user deletes it.
  const neededBy = {};
  for (const x of data.tracked) if (x.enabled !== false) for (const pid of x.needs || []) (neededBy[pid] = neededBy[pid] || []).push(x.title);
  const count = (ty) => data.tracked.filter((e) => e.type === ty).length + data.local.filter((e) => e.type === ty).length;
  const upd = S.updates && S.updates.instId === inst.id ? S.updates.list : null;
  const updFor = (id) => upd && upd.find((u) => u.id === id);

  return `
    <div class="page-head"><div><h1>Installed</h1><p>Everything in ${esc(inst.name)}. Toggle without deleting, update with one click.</p></div>${instBar(inst)}</div>
    <div class="row" style="margin-bottom:14px">
      <div class="seg">${Object.entries(TYPE_LABEL).map(([ty, l]) => `<button class="${t === ty ? 'on' : ''}" data-act="content-tab" data-t="${ty}">${l} <span class="dim">${count(ty)}</span></button>`).join('')}</div>
      <div class="search" style="width:210px">${ic('search')}<input class="input" id="content-q" placeholder="Filter ${TYPE_LABEL[t].toLowerCase()}" value="${esc(S.contentFilter || '')}"></div>
      <span class="grow"></span>
      ${upd && upd.length ? `<button class="btn primary sm" data-act="update-all">${ic('up')}Update all (${upd.length})</button>` : ''}
      <button class="btn sm" data-act="check-updates">${ic('refresh')}${upd ? (upd.length ? `${upd.length} updates` : 'Up to date') : 'Check updates'}</button>
      <button class="btn sm" data-act="open-instance" data-id="${inst.id}" data-sub="${{ mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' }[t]}">${ic('folder')}Folder</button>
      <button class="btn sm" data-act="browse-more" data-t="${t}">${ic('plus')}Add</button>
    </div>
    ${t === 'shader' && !hasIris ? `<div class="banner">${ic('info')}<div class="grow"><b>Shaders need Iris.</b><div class="small muted">Iris is the mod that loads shader packs. Install it and use the buttons below to pick one.</div></div><button class="btn primary sm" data-act="enable-iris" ${inst.loader !== 'fabric' ? 'disabled' : ''}>Install Iris</button></div>` : ''}
    <div class="card list">
      ${tracked.map((e) => {
        const u = updFor(e.id);
        return `<div class="item ${e.enabled === false ? 'off' : ''}">
          ${e.icon ? `<img src="${esc(e.icon)}" alt="">` : `<div class="ph">${ic('package')}</div>`}
          <div class="grow" style="min-width:0"><div class="row" style="gap:8px"><span class="t" data-nt>${esc(e.title)}</span>
            ${e.module ? '<span class="badge accent">Module</span>' : ''}${e.dependency ? '<span class="badge">Dependency</span>' : ''}${e.incompatible ? `<span class="badge warn">No ${esc(e.incompatible)} build</span>` : ''}</div>
            <div class="s">${esc(e.versionNumber)} · ${esc(e.file)}${neededBy[e.id] ? ` · needed by ${esc(neededBy[e.id].slice(0, 3).join(', '))}${neededBy[e.id].length > 3 ? ` +${neededBy[e.id].length - 3}` : ''}` : ''}</div></div>
          ${u ? `<button class="btn sm primary" data-act="update-one" data-id="${esc(e.id)}" data-type="${e.type}" title="${esc(u.from)} → ${esc(u.to)}">${ic('up')}${esc(u.to)}</button>` : ''}
          ${useBtn(e.type, e.file, e.enabled)}
          <button class="switch ${e.enabled !== false ? 'on' : ''}" data-act="content-toggle" data-id="${esc(e.id)}"></button>
          <button class="btn sm icon ghost danger" data-act="content-remove" data-id="${esc(e.id)}" title="Remove">${ic('trash')}</button>
        </div>`;
      }).join('')}
      ${local.map((e) => `<div class="item ${e.enabled ? '' : 'off'}">
          <div class="ph">${ic('file')}</div>
          <div class="grow" style="min-width:0"><div class="row" style="gap:8px"><span class="t" data-nt>${esc(e.title)}</span><span class="badge">Local file</span></div><div class="s">Added manually</div></div>
          ${useBtn(e.type, e.file, e.enabled)}
          <button class="switch ${e.enabled ? 'on' : ''}" data-act="local-toggle" data-file="${esc(e.file)}" data-type="${e.type}"></button>
          <button class="btn sm icon ghost danger" data-act="local-remove" data-file="${esc(e.file)}" data-type="${e.type}" title="Remove">${ic('trash')}</button>
        </div>`).join('')}
      ${!tracked.length && !local.length ? `<div class="empty">${ic('package')}<h3>${q ? 'Nothing matches' : `No ${TYPE_LABEL[t].toLowerCase()} yet`}</h3><p>${q ? 'Try a different search.' : `Find some in Browse${t === 'mod' ? ' or enable Client Modules' : ''}.`}</p></div>` : ''}
    </div>`;
}

// Filtering repaints the page from the cached list (no round trip) and keeps focus and caret in the box.
function bindContentFilter(page) {
  const box = page.querySelector('#content-q');
  if (!box) return;
  box.addEventListener('input', () => {
    S.contentFilter = box.value;
    const c = S.contentCache;
    const inst = cur();
    if (!c || !inst || c.instId !== inst.id) return;
    const pos = box.selectionStart;
    page.innerHTML = contentHtml(inst, JSON.parse(c.json));
    const again = page.querySelector('#content-q');
    again.focus();
    again.setSelectionRange(pos, pos);
    bindContentFilter(page);
  });
}

VIEWS.content = async (page) => {
  const inst = cur();
  if (!inst) return needInstance(page, 'manage content');
  // Paint the last known list at once; swapping in a spinner on every tab switch or toggle made the page flash and lose its scroll.
  const c = S.contentCache;
  const cached = c && c.instId === inst.id ? c.json : null;
  page.innerHTML = cached ? contentHtml(inst, JSON.parse(cached)) : '<div class="loading"><span class="spinner"></span></div>';
  bindContentFilter(page);
  let data;
  try {
    data = await api.call('content:list', inst.id);
  } catch (e) {
    if (!cached) page.innerHTML = `<div class="empty"><h3>${esc(e.message)}</h3></div>`;
    return;
  }
  const json = JSON.stringify(data);
  S.contentCache = { instId: inst.id, json };
  if (S.view !== 'content' || json === cached) return;
  // Don't replace the page under the user's fingers while they are typing in the filter.
  const typing = document.activeElement && document.activeElement.id === 'content-q';
  const pos = typing ? document.activeElement.selectionStart : 0;
  page.innerHTML = contentHtml(inst, data);
  bindContentFilter(page);
  if (typing) { const box = page.querySelector('#content-q'); box.focus(); box.setSelectionRange(pos, pos); }
};

function serverCard(s) {
  const st = S.serverStatus[s.address];
  const online = st && st.online;
  return `<div class="card server" id="${srvId(s.address)}">
    ${st && st.icon ? `<img src="${esc(st.icon)}" alt="">` : '<div class="ph"></div>'}
    <div class="grow" style="min-width:0">
      <div class="row" style="gap:8px"><b data-nt>${esc(s.name)}</b><span class="dot ${st ? (online ? 'on' : 'off') : ''}"></span>
        <span class="small muted">${st ? (online ? `${fmtNum(st.players.online)} / ${fmtNum(st.players.max)} online` : 'Offline') : 'Pinging…'}</span></div>
      <div class="motd" data-nt>${st && st.motd ? esc(st.motd.clean.join(' ')) : esc(s.address)}</div>
      ${st && st.version ? `<div class="small dim" data-nt>${esc(String(st.version).slice(0, 40))}</div>` : ''}
    </div>
    <button class="btn sm primary" data-act="join" data-addr="${esc(s.address)}" ${S.game.state !== 'idle' || !cur() ? 'disabled' : ''}>${ic('play')}Join</button>
    ${S.view === 'servers' ? `<button class="btn sm icon ghost danger" data-act="remove-server" data-i="${S.cfg.servers.indexOf(s)}" title="Remove">${ic('trash')}</button>` : ''}
  </div>`;
}

function pingServers(list) {
  for (const s of list) {
    if (S.serverStatus[s.address]) continue;
    const show = (st) => {
      S.serverStatus[s.address] = st;
      const el = document.getElementById(srvId(s.address));
      if (el) el.outerHTML = serverCard(s);
    };
    // A failed lookup must not leave the card on "Pinging…" forever.
    api.call('server:status', s.address).then(show).catch(() => show({ online: false }));
  }
}

VIEWS.servers = (page) => {
  page.innerHTML = `
    <div class="page-head"><div><h1>Servers</h1><p>Live status and one-click join with your selected instance${cur() ? ` (${esc(cur().name)}, ${esc(cur().version)})` : ''}.</p></div>
      <button class="btn" data-act="refresh-servers">${ic('refresh')}Refresh</button></div>
    <div class="card" style="padding:14px;margin-bottom:16px">
      <form class="row" id="add-server">
        <input class="input" name="name" placeholder="Name" style="max-width:220px" required>
        <input class="input" name="address" placeholder="Address, e.g. play.example.net:25565" required>
        <button class="btn primary">${ic('plus')}Add</button>
      </form>
    </div>
    <div class="servers">${S.cfg.servers.map((s) => serverCard(s)).join('')}</div>
    ${!S.cfg.servers.length ? `<div class="empty">${ic('server')}<h3>No servers</h3><p>Add your favourite servers above.</p></div>` : ''}`;
  $('#add-server').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const servers = [...S.cfg.servers, { name: f.get('name').trim(), address: f.get('address').trim() }];
    await saveCfg({ servers });
    render();
    pingServers(servers);
  });
  pingServers(S.cfg.servers);
};

VIEWS.screenshots = async (page) => {
  const inst = cur();
  if (!inst) return needInstance(page, 'see screenshots');
  const shots = await api.call('screenshots:list', inst.id);
  if (S.view !== 'screenshots') return;
  page.innerHTML = `
    <div class="page-head"><div><h1>Screenshots</h1><p>${shots.length} shots from ${esc(inst.name)} · press F2 in-game to take one.</p></div>
      <div class="row">${instBar(inst)}<button class="btn" data-act="open-instance" data-id="${inst.id}" data-sub="screenshots">${ic('folder')}Folder</button></div></div>
    ${shots.length ? `<div class="shots">${shots.map((s) => `<div class="shot" data-act="lightbox" data-path="${esc(s.path)}"><img src="${esc(fileUrl(s.path))}" loading="lazy" alt=""></div>`).join('')}</div>`
      : `<div class="empty">${ic('image')}<h3>No screenshots yet</h3><p>Press F2 while playing.</p></div>`}`;
};

function logClass(line, level) {
  if (level === 'info') return 'l-info';
  if (/\b(ERROR|FATAL|SEVERE)\b|Exception|^\s+at /.test(line) || level === 'err') return 'l-err';
  if (/\bWARN\b/.test(line)) return 'l-warn';
  return 'l-out';
}

VIEWS.console = (page) => {
  page.innerHTML = `
    <div class="page-head"><div><h1>Console</h1><p>${S.game.state === 'running' ? '<span class="badge ok">● Game running</span>' : 'Live game output appears here.'}</p></div>
      <div class="row">
        <div class="search" style="width:220px">${ic('search')}<input class="input" id="log-q" placeholder="Filter log" value="${esc(S.logFilter || '')}"></div>
        <button class="btn" data-act="copy-logs">${ic('copy')}Copy</button>
        <button class="btn" data-act="open-logs">${ic('folder')}Logs folder</button>
        <button class="btn" data-act="clear-logs">${ic('trash')}Clear</button>
        ${S.game.state === 'running' ? `<button class="btn danger" data-act="kill">${ic('stop')}Kill game</button>` : ''}
      </div></div>
    <div class="card console" id="console">${logHtml()}</div>`;
  const c = $('#console');
  c.scrollTop = c.scrollHeight;
  // Filter in place so the input keeps focus while typing.
  $('#log-q').addEventListener('input', (e) => {
    S.logFilter = e.target.value;
    c.innerHTML = logHtml();
    c.scrollTop = c.scrollHeight;
  });
};

const logMatches = (line) => !S.logFilter || line.toLowerCase().includes(S.logFilter.toLowerCase());
function logHtml() {
  const rows = S.logs.filter(([l]) => logMatches(l));
  if (rows.length) return rows.map(([l, lv]) => `<div class="${logClass(l, lv)}">${esc(l)}</div>`).join('');
  return `<span class="dim">${S.logs.length ? 'No lines match the filter.' : 'No output yet. Launch the game to see logs.'}</span>`;
}

VIEWS.settings = (page) => {
  const st = S.cfg.settings;
  const maxRam = Math.max(2048, Math.min(32768, Math.floor((S.sys.totalMem - 1536) / 512) * 512));
  const pct = ((st.ram - 1024) / (maxRam - 1024)) * 100;
  const accents = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899'];
  page.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>Accounts, performance and launcher behaviour.</p></div></div>
    <div class="settings">
      <div class="card panel">
        <h3>Accounts</h3><p>Offline accounts work in singleplayer and on servers with online-mode off.</p>
        <div class="stack">
          ${S.cfg.accounts.map((a) => `<div class="acc ${a.id === S.cfg.selectedAccount ? 'on' : ''}">
            <img class="avatar" src="${avatar(a.name)}" alt=""><div class="grow"><b data-nt>${esc(a.name)}</b><div class="small muted">${a.type === 'msa' ? 'Microsoft' : 'Offline'} · ${esc(a.uuid.slice(0, 8))}…</div></div>
            ${a.id === S.cfg.selectedAccount ? '<span class="badge accent">Active</span>' : `<button class="btn sm" data-act="select-account" data-id="${a.id}">Use</button>`}
            <button class="btn sm icon ghost danger" data-act="remove-account" data-id="${a.id}">${ic('trash')}</button></div>`).join('')}
          <form class="row" id="add-acc"><input class="input" name="name" placeholder="Nickname" maxlength="16" required><button class="btn primary">${ic('plus')}Add</button></form>
          <div class="small dim">Microsoft sign-in requires a registered Azure application and is planned for a future release.</div>
        </div>
      </div>

      <div class="card panel">
        <h3>Memory & Java</h3><p>Defaults for every instance. Instances can override RAM.</p>
        <div class="stack">
          <div><div class="opt"><span class="k">Allocated RAM</span><b id="ram-v">${(st.ram / 1024).toFixed(1)} GB</b></div>
            <input type="range" id="ram" min="1024" max="${maxRam}" step="512" value="${st.ram}" style="--p:${pct}%;margin-top:10px">
            <div class="row small dim" style="justify-content:space-between"><span>1 GB</span><span>${(S.sys.totalMem / 1024).toFixed(0)} GB in system</span></div></div>
          <div class="row"><label class="field grow">Window width<input class="input" id="w" type="number" value="${st.width}"></label><label class="field grow">Height<input class="input" id="h" type="number" value="${st.height}"></label></div>
          <label class="field">Extra JVM arguments<textarea class="input" id="jvm" rows="2" placeholder="-XX:+UseZGC">${esc(st.jvmArgs)}</textarea></label>
          <label class="field"><span>Custom Java path <span class="dim" style="font-weight:400">— empty uses the bundled runtime</span></span><input class="input" id="java" value="${esc(st.javaPath)}" placeholder="Automatic"></label>
        </div>
      </div>

      <div class="card panel">
        <h3>Launcher</h3><p>Appearance and behaviour.</p>
        <div class="stack">
          <div class="opt"><div><div class="k">Language</div></div><select class="input" id="lang" style="width:190px"><option value="auto" ${(st.language || 'auto') === 'auto' ? 'selected' : ''}>Auto (as in system)</option><option value="en" ${st.language === 'en' ? 'selected' : ''}>English</option><option value="ru" ${st.language === 'ru' ? 'selected' : ''}>Русский</option></select></div>
          <div class="opt"><div><div class="k">Hide launcher while playing</div><div class="d">Comes back when the game closes.</div></div><button class="switch ${st.closeOnLaunch ? 'on' : ''}" data-act="setting-toggle" data-k="closeOnLaunch"></button></div>
          <div class="opt"><div><div class="k">Start in fullscreen</div><div class="d">Minecraft opens fullscreen instead of in a window.</div></div><button class="switch ${st.fullscreen ? 'on' : ''}" data-act="setting-toggle" data-k="fullscreen"></button></div>
          <div class="opt"><div><div class="k">Show snapshots</div><div class="d">Include snapshot versions when creating instances.</div></div><button class="switch ${st.showSnapshots ? 'on' : ''}" data-act="setting-toggle" data-k="showSnapshots"></button></div>
          <div><div class="k" style="margin-bottom:10px;font-weight:600">Accent colour</div>
            <div class="swatches">${accents.map((c) => `<div class="swatch ${st.accent === c ? 'on' : ''}" style="background:${c};color:${c}" data-act="accent" data-c="${c}"></div>`).join('')}</div></div>
        </div>
      </div>

      <div class="card panel">
        <h3>Storage</h3><p>Game files are shared between instances to save space.</p>
        <div class="stack">
          <div class="small muted" data-nt style="word-break:break-all;user-select:text">${esc(S.sys.root)}</div>
          <div id="storage-box"><span class="spinner" style="width:14px;height:14px"></span> <span class="small muted">Measuring…</span></div>
          <div class="row"><button class="btn" data-act="open-data">${ic('folder')}Open data folder</button><button class="btn" data-act="open-log">${ic('file')}launcher.log</button></div>
          <div class="small dim">Lumen Client ${esc(S.sys.version)} · Not affiliated with Mojang or Microsoft.</div>
        </div>
      </div>
    </div>`;

  paintStorage();
  // The language applies to the whole interface, so the window simply reloads in the new language.
  $('#lang').addEventListener('change', async (e) => { await saveCfg({ settings: { language: e.target.value } }); location.reload(); });
  const ram = $('#ram');
  ram.addEventListener('input', () => {
    $('#ram-v').textContent = `${(ram.value / 1024).toFixed(1)} GB`;
    ram.style.setProperty('--p', `${((ram.value - 1024) / (maxRam - 1024)) * 100}%`);
  });
  ram.addEventListener('change', () => saveCfg({ settings: { ram: +ram.value } }));
  $('#w').addEventListener('change', (e) => saveCfg({ settings: { width: +e.target.value || 1280 } }));
  $('#h').addEventListener('change', (e) => saveCfg({ settings: { height: +e.target.value || 720 } }));
  $('#jvm').addEventListener('change', (e) => saveCfg({ settings: { jvmArgs: e.target.value.trim() } }));
  $('#java').addEventListener('change', (e) => saveCfg({ settings: { javaPath: e.target.value.trim() } }));
  $('#add-acc').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      S.cfg = await api.call('accounts:addOffline', new FormData(e.target).get('name').trim());
      render();
    } catch (err) { toast(err.message, 'err'); }
  });
};

// ---------------- HUD editor ----------------
// Preview uses Minecraft's GUI-scaled space for 1280x720 at GUI scale 3, so offsets match in-game pixels.
const HUD_W = 427;
const HUD_H = 240;
const HUD_EL = { fps: 'FPS', cps: 'CPS', ping: 'Ping', speed: 'Speed', clock: 'Clock', coords: 'Coordinates', keystrokes: 'Keystrokes', armor: 'Armor', effects: 'Potion effects', reach: 'Reach', combo: 'Combo', memory: 'Memory', session: 'Session time', items: 'Item counter', target: 'Target info', server: 'Server address', sprint: 'Sprint status', death: 'Last death', alert: 'Durability alert', compass: 'Compass' };
const HUD_OPTS = {
  coords: [['coordsFacing', 'Show facing'], ['coordsBiome', 'Show biome']],
  keystrokes: [['keystrokesCps', 'CPS under mouse buttons'], ['keystrokesSpace', 'Space bar']],
  armor: [['armorDurability', 'Durability numbers'], ['armorHeldItem', 'Held item']],
  clock: [['clock24', '24-hour format']],
  memory: [['memoryShowMax', 'Show maximum']],
  death: [['deathChat', 'Say it in chat after respawn']],
  items: [['itemsTotems', 'Totems'], ['itemsGapples', 'Golden apples'], ['itemsPearls', 'Ender pearls'], ['itemsCrystals', 'End crystals']],
};
// Which versions have a Lumen HUD build is decided in core/hud.js; the page asks once at start-up.
const hudSupports = (v) => !!S.hudInfo && S.hudInfo.matchers.some((m) => new RegExp(m).test(v));
let hudSaveTimer;

const hudPlace = (a, off, screen, size) => {
  a = a >= 0.75 ? 1 : a >= 0.25 ? 0.5 : 0;
  const pos = a * (screen - size) + (a === 1 ? -off : off);
  return Math.round(Math.min(Math.max(pos, 0), Math.max(0, screen - size)));
};
// Same rules as EditScreen.anchor() in the mod.
const hudAnchor = (pos, screen, size) => {
  pos = Math.min(Math.max(pos, 0), Math.max(0, screen - size));
  const c = pos + size / 2;
  const free = screen - size;
  if (Math.abs(c - screen / 2) < 4) return [0.5, 0];
  if (c < screen / 3) return [0, Math.round(pos)];
  if (c > (screen * 2) / 3) return [1, Math.round(free - pos)];
  return [0.5, Math.round(pos - free / 2)];
};

function hudSave() {
  clearTimeout(hudSaveTimer);
  const h = S.hud;
  h.dirty = true;
  hudSaveTimer = setTimeout(async () => {
    await api.call('hud:set', h.instId, h.cfg);
    h.dirty = false;
    const el = $('#hud-saved');
    if (el) { el.textContent = 'Saved · applies live in-game'; el.style.opacity = 1; setTimeout(() => { el.style.opacity = 0.5; }, 1200); }
  }, 200);
}

function hudElementHtml(id) {
  const c = S.hud.cfg;
  const icons = S.hud.icons || {};
  const v = (t) => `<span class="hv">${esc(t)}</span>`;
  const a = (t) => `<span class="ha">${esc(t)}</span>`;
  switch (id) {
    case 'fps': return `<div class="hbox">${v('144')}${a(' FPS')}</div>`;
    case 'cps': return `<div class="hbox">${v('7 | 2')}${a(' CPS')}</div>`;
    case 'ping': return `<div class="hbox">${v('32')}${a(' ms')}</div>`;
    case 'speed': return `<div class="hbox">${v('5.6')}${a(' b/s')}</div>`;
    case 'clock': return `<div class="hbox">${v(c.clock24 ? '21:45' : '9:45 PM')}</div>`;
    case 'reach': return `<div class="hbox">${v('3.12')}${a(' blocks')}</div>`;
    case 'combo': return `<div class="hbox">${v('4')}${a(' combo')}</div>`;
    case 'memory': return `<div class="hbox">${v(c.memoryShowMax ? '1480/4096' : '1480')}${a(' MB')}</div>`;
    case 'session': return `<div class="hbox">${v('1:12:40')}</div>`;
    case 'server': return `<div class="hbox">${v('play.example.net')}</div>`;
    case 'compass': return `<div class="hbox compass"><div class="cstrip"><b>W</b><i></i><i></i><b class="c">N</b><i></i><i></i><b>E</b><i></i><i></i><b>S</b></div><div class="cdot" style="left:112px;background:#10b981"></div><div class="chead"></div></div>`;
    case 'death': return `<div class="hbox">${a('Death')} ${v('-120 64 310 (Overworld)')}</div>`;
    case 'alert': return `<div class="hbox">${`<span style="color:#ff5555">Low durability: Iron Helmet ${c.durabilityPercent}%</span>`}</div>`;
    case 'sprint': return `<div class="hbox">${a('Sprinting (toggled)')}</div>`;
    case 'target': return `<div class="hbox">${v('Zombie')}${a('  14/20')}<div class="hbar"><i style="width:70%"></i></div></div>`;
    case 'items': {
      const rows = [[c.itemsTotems, '#e9c46a', 2], [c.itemsGapples, '#f4a261', 5], [c.itemsPearls, '#2a9d8f', 16], [c.itemsCrystals, '#c77dff', 8]].filter((r) => r[0]);
      return `<div class="hbox armor">${rows.map(([, col, n]) => `<div class="arow"><b style="background:${col};border-radius:3px"></b><span>${n}</span></div>`).join('') || v('Items')}</div>`;
    }
    case 'effects': return `<div class="hbox lines"><div>${a('Speed 2')} ${v('4:12')}</div><div>${a('Night Vision')} ${v('8:00')}</div><div>${a('Regeneration')} ${v('0:23')}</div></div>`;
    case 'coords': return `<div class="hbox lines">
      <div>${a('XYZ')} ${v('-128 72 340')}</div>
      ${c.coordsFacing ? `<div>${a('Facing')} ${v('north (-Z)')}</div>` : ''}
      ${c.coordsBiome ? `<div>${a('Biome')} ${v('cherry grove')}</div>` : ''}</div>`;
    case 'keystrokes': {
      const k = (l, x, y, w, on, sub) => `<div class="hkey ${on ? 'on' : ''}" style="left:${x}px;top:${y}px;width:${w}px">${sub ? `<span style="margin-top:-4px">${l}</span><small>${sub}</small>` : l}</div>`;
      return `<div class="hkeys" style="height:${c.keystrokesSpace ? 82 : 70}px">
        ${k('W', 24, 0, 22, true)}${k('A', 0, 24, 22)}${k('S', 24, 24, 22)}${k('D', 48, 24, 22)}
        ${k('LMB', 0, 48, 34, true, c.keystrokesCps ? '7 CPS' : '')}${k('RMB', 36, 48, 34, false, c.keystrokesCps ? '2 CPS' : '')}
        ${c.keystrokesSpace ? '<div class="hkey space" style="left:0;top:72px;width:70px;height:10px"><i></i></div>' : ''}</div>`;
    }
    case 'armor': {
      const rows = [['diamond_helmet', 363, '#55ff55'], ['iron_chestplate', 240, '#55ff55'], ['diamond_leggings', 15, '#ff5555'], ['golden_boots', 91, '#55ff55']];
      if (c.armorHeldItem) rows.push(['netherite_sword', 2031, '#55ff55']);
      return `<div class="hbox armor">${rows.map(([n, d, col]) => `<div class="arow">${icons[n] ? `<img src="${icons[n]}">` : '<b></b>'}${c.armorDurability ? `<span style="color:${col}">${d}</span>` : ''}</div>`).join('')}</div>`;
    }
    default: return '';
  }
}

function hudRenderPreview() {
  const root = $('#hud-canvas');
  if (!root) return;
  const c = S.hud.cfg;
  root.style.setProperty('--ht', c.textColor);
  root.style.setProperty('--ha', c.accentColor);
  root.style.setProperty('--hbg', c.background ? `rgba(0,0,0,${c.bgOpacity})` : 'transparent');
  root.style.setProperty('--hkey', c.background ? `rgba(0,0,0,${c.bgOpacity})` : 'rgba(0,0,0,.19)');
  root.classList.toggle('shadow', !!c.shadow);
  root.classList.remove('theme-glass', 'theme-flat', 'theme-minimal');
  root.classList.add(`theme-${c.theme || 'glass'}`);
  root.querySelectorAll('.hel').forEach((n) => n.remove());
  for (const id of Object.keys(HUD_EL)) {
    const e = c.elements[id];
    const div = document.createElement('div');
    div.className = `hel ${e.enabled ? '' : 'off'} ${S.hud.sel === id ? 'sel' : ''}`;
    div.dataset.id = id;
    div.innerHTML = hudElementHtml(id);
    root.appendChild(div);
  }
  hudLayout();
}

function hudLayout() {
  const root = $('#hud-canvas');
  if (!root) return;
  root.querySelectorAll('.hel').forEach((div) => {
    const e = S.hud.cfg.elements[div.dataset.id];
    const s = Math.min(3, Math.max(0.5, e.scale || 1));
    const w = div.offsetWidth * s;
    const h = div.offsetHeight * s;
    div.style.transform = `translate(${hudPlace(e.ax, e.x, HUD_W, w)}px, ${hudPlace(e.ay, e.y, HUD_H, h)}px) scale(${s})`;
  });
}

function hudFit() {
  const stage = $('#hud-stage');
  const canvas = $('#hud-canvas');
  if (!stage || !canvas) return;
  canvas.style.transform = `scale(${stage.clientWidth / HUD_W})`;
}
window.addEventListener('resize', () => S.view === 'hud' && hudFit());
// The in-game editor (Right Shift) can change the file while the launcher is open; pick that up on return.
window.addEventListener('focus', async () => {
  const h = S.hud;
  if (S.view !== 'hud' || !h || h.dirty) return;
  try {
    const cfg = await api.call('hud:get', h.instId);
    if (S.hud === h && !h.dirty) { h.cfg = cfg; hudRenderPreview(); hudRenderPanel(); }
  } catch {}
});

function hudBindStage() {
  const stage = $('#hud-stage');
  const k = () => stage.clientWidth / HUD_W;
  stage.addEventListener('mousedown', (ev) => {
    const div = ev.target.closest('.hel');
    if (!div || ev.button !== 0) return;
    ev.preventDefault();
    const id = div.dataset.id;
    const e = S.hud.cfg.elements[id];
    const s = e.scale || 1;
    const w = div.offsetWidth * s;
    const h = div.offsetHeight * s;
    const r = stage.getBoundingClientRect();
    const startX = hudPlace(e.ax, e.x, HUD_W, w);
    const startY = hudPlace(e.ay, e.y, HUD_H, h);
    const offX = (ev.clientX - r.left) / k() - startX;
    const offY = (ev.clientY - r.top) / k() - startY;
    if (S.hud.sel !== id) { S.hud.sel = id; hudRenderPanel(); stage.querySelectorAll('.hel').forEach((n) => n.classList.toggle('sel', n.dataset.id === id)); }
    stage.classList.add('dragging');
    const move = (m) => {
      [e.ax, e.x] = hudAnchor((m.clientX - r.left) / k() - offX, HUD_W, w);
      [e.ay, e.y] = hudAnchor((m.clientY - r.top) / k() - offY, HUD_H, h);
      hudLayout();
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      stage.classList.remove('dragging');
      hudSave();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
  stage.addEventListener('wheel', (ev) => {
    const div = ev.target.closest('.hel');
    if (!div) return;
    ev.preventDefault();
    const e = S.hud.cfg.elements[div.dataset.id];
    e.scale = Math.round(Math.min(3, Math.max(0.5, (e.scale || 1) + (ev.deltaY < 0 ? 0.1 : -0.1))) * 10) / 10;
    S.hud.sel = div.dataset.id;
    hudLayout();
    hudRenderPanel();
    hudSave();
  }, { passive: false });
  stage.addEventListener('contextmenu', (ev) => {
    const div = ev.target.closest('.hel');
    if (!div) return;
    ev.preventDefault();
    const e = S.hud.cfg.elements[div.dataset.id];
    e.enabled = !e.enabled;
    div.classList.toggle('off', !e.enabled);
    hudRenderPanel();
    hudSave();
  });
}

function hudRenderPanel() {
  const el = $('#hud-panel');
  if (!el) return;
  const c = S.hud.cfg;
  const sel = S.hud.sel;
  const sw = (on, act, key) => `<button class="switch ${on ? 'on' : ''}" data-act="${act}" data-k="${key}"></button>`;
  const colors = ['#FFFFFF', '#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  el.innerHTML = `
    <div class="card panel">
      <h3>Elements</h3><p>Drag in the preview · scroll to resize · right-click to hide.</p>
      <div class="hud-els">${Object.entries(HUD_EL).map(([id, name]) => `
        <div class="hud-el ${sel === id ? 'sel' : ''}" data-act="hud-select" data-id="${id}">
          <div class="grow"><b>${name}</b><div class="small dim">${Math.round((c.elements[id].scale || 1) * 100)}%</div></div>
          ${sw(c.elements[id].enabled, 'hud-el-toggle', id)}
        </div>`).join('')}</div>
      ${sel ? `<div class="stack" style="margin-top:14px">
        <div><div class="opt"><span class="k">${HUD_EL[sel]} size</span><b>${Math.round((c.elements[sel].scale || 1) * 100)}%</b></div>
          <input type="range" id="hud-scale" min="0.5" max="3" step="0.1" value="${c.elements[sel].scale || 1}" style="--p:${(((c.elements[sel].scale || 1) - 0.5) / 2.5) * 100}%;margin-top:8px"></div>
        ${(HUD_OPTS[sel] || []).map(([k, l]) => `<div class="opt"><span>${l}</span>${sw(c[k], 'hud-opt', k)}</div>`).join('')}
        ${sel === 'alert' ? `<div><div class="opt small"><span class="muted">Warn below</span><span>${c.durabilityPercent}%</span></div><input type="range" id="hud-durability" min="5" max="50" step="1" value="${c.durabilityPercent}" style="--p:${((c.durabilityPercent - 5) / 45) * 100}%;margin-top:6px"></div>` : ''}
      </div>` : ''}
    </div>
    <div class="card panel">
      <h3>Client features</h3><p>Work in-game, no extra mods needed.</p>
      <div class="stack">
        <div class="opt"><span>Toggle sprint<div class="small dim">Keeps you sprinting while you hold W</div></span>${sw(c.toggleSprint, 'hud-opt', 'toggleSprint')}</div>
        <div class="opt"><span>Toggle sneak<div class="small dim">Press the sneak key once to sneak, again to stop</div></span>${sw(c.toggleSneak, 'hud-opt', 'toggleSneak')}</div>
        <div class="opt"><span>Freelook<div class="small dim">Hold Left Alt to look around without turning</div></span>${sw(c.freelook, 'hud-opt', 'freelook')}</div>
        <div class="opt"><span>Fullbright<div class="small dim">Dark caves and nights are fully lit</div></span>${sw(c.fullbright, 'hud-opt', 'fullbright')}</div>
        <div class="opt"><span>Zoom<div class="small dim">Hold C in-game to zoom in</div></span>${sw(c.zoom, 'hud-opt', 'zoom')}</div>
        ${c.zoom ? `<div class="opt"><span>Smooth zoom</span>${sw(c.smoothZoom, 'hud-opt', 'smoothZoom')}</div>` : ''}
        ${c.zoom ? `<div><div class="opt small"><span class="muted">Zoom field of view</span><span>${c.zoomFov}°</span></div>
          <input type="range" id="hud-zoomfov" min="5" max="60" step="1" value="${c.zoomFov}" style="--p:${((c.zoomFov - 5) / 55) * 100}%;margin-top:6px"></div>` : ''}
      </div>
    </div>
    <div class="card panel">
      <h3>Style</h3><p>Applies to every element.</p>
      <div class="stack">
        <div><div class="k" style="font-weight:600;margin-bottom:8px">Preset</div>
          <div class="seg">${Object.keys((S.hudInfo && S.hudInfo.presets) || {}).map((k) => `<button data-act="hud-preset" data-k="${k}">${k}</button>`).join('')}</div></div>
        <div><div class="k" style="font-weight:600;margin-bottom:8px">Theme</div>
          <div class="seg">${[['glass', 'Glass'], ['flat', 'Flat'], ['minimal', 'Minimal']].map(([k, l]) => `<button class="${(c.theme || 'glass') === k ? 'on' : ''}" data-act="hud-theme" data-k="${k}">${l}</button>`).join('')}</div></div>
        <div><div class="k" style="font-weight:600;margin-bottom:8px">Text colour</div>
          <div class="row" style="gap:6px">${colors.map((x) => `<div class="swatch sm ${c.textColor.toUpperCase() === x ? 'on' : ''}" style="background:${x};color:${x}" data-act="hud-color" data-k="textColor" data-c="${x}"></div>`).join('')}<input type="color" class="cpick" data-k="textColor" value="${esc(c.textColor)}"></div></div>
        <div><div class="k" style="font-weight:600;margin-bottom:8px">Accent colour</div>
          <div class="row" style="gap:6px">${colors.map((x) => `<div class="swatch sm ${c.accentColor.toUpperCase() === x ? 'on' : ''}" style="background:${x};color:${x}" data-act="hud-color" data-k="accentColor" data-c="${x}"></div>`).join('')}<input type="color" class="cpick" data-k="accentColor" value="${esc(c.accentColor)}"></div></div>
        <div class="opt"><span>Background</span>${sw(c.background, 'hud-opt', 'background')}</div>
        ${c.background ? `<div><div class="opt small"><span class="muted">Opacity</span><span>${Math.round(c.bgOpacity * 100)}%</span></div>
          <input type="range" id="hud-opacity" min="0" max="1" step="0.05" value="${c.bgOpacity}" style="--p:${c.bgOpacity * 100}%;margin-top:6px"></div>` : ''}
        <div class="opt"><span>Text shadow</span>${sw(c.shadow, 'hud-opt', 'shadow')}</div>
        <div class="opt"><span>Hide when F3 is open</span>${sw(c.hideInDebug, 'hud-opt', 'hideInDebug')}</div>
        <button class="btn sm" data-act="hud-reset">${ic('refresh')}Reset layout & style</button>
      </div>
    </div>`;
  const sc = $('#hud-scale');
  if (sc) sc.addEventListener('input', () => {
    c.elements[sel].scale = +sc.value;
    sc.style.setProperty('--p', `${((sc.value - 0.5) / 2.5) * 100}%`);
    sc.parentElement.querySelector('b').textContent = `${Math.round(sc.value * 100)}%`;
    hudLayout();
    hudSave();
  });
  const zf = $('#hud-zoomfov');
  if (zf) zf.addEventListener('input', () => {
    c.zoomFov = +zf.value;
    zf.style.setProperty('--p', `${((zf.value - 5) / 55) * 100}%`);
    zf.parentElement.querySelector('.opt span:last-child').textContent = `${zf.value}°`;
    hudSave();
  });
  const du = $('#hud-durability');
  if (du) du.addEventListener('input', () => {
    c.durabilityPercent = +du.value;
    du.style.setProperty('--p', `${((du.value - 5) / 45) * 100}%`);
    du.parentElement.querySelector('.opt span:last-child').textContent = `${du.value}%`;
    hudRenderPreview();
    hudSave();
  });
  const op = $('#hud-opacity');
  if (op) op.addEventListener('input', () => {
    c.bgOpacity = +op.value;
    op.style.setProperty('--p', `${op.value * 100}%`);
    op.parentElement.querySelector('.opt span:last-child').textContent = `${Math.round(op.value * 100)}%`;
    hudRenderPreview();
    hudSave();
  });
  el.querySelectorAll('.cpick').forEach((inp) => inp.addEventListener('input', () => {
    c[inp.dataset.k] = inp.value.toUpperCase();
    hudRenderPreview();
    hudSave();
  }));
}

VIEWS.hud = async (page) => {
  const inst = cur();
  if (!inst) return needInstance(page, 'use Lumen HUD');
  const supported = inst.loader === 'fabric' && hudSupports(inst.version);
  const installed = !!inst.content['lumen-hud'];
  if (!S.hud || S.hud.instId !== inst.id) {
    page.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    const [cfg, icons] = await Promise.all([api.call('hud:get', inst.id), api.call('hud:icons').catch(() => ({}))]);
    S.hud = { instId: inst.id, cfg, icons, sel: 'fps' };
    if (S.view !== 'hud') return;
  }
  const bg = S.news && S.news[0] && S.news[0].image;
  page.innerHTML = `
    <div class="page-head"><div><h1>HUD Editor</h1><p>Lumen HUD is our own Fabric mod. Edits save instantly and apply live, even mid-game. <span id="hud-saved" class="badge accent" style="opacity:.5;transition:opacity .3s">Right Shift in-game opens the editor too</span></p></div>${instBar(inst)}</div>
    ${!supported ? `<div class="banner">${ic('info')}<div class="grow"><b>Lumen HUD runs on Fabric ${S.hudInfo.versions.join(', ')}.</b><div class="small muted">${esc(inst.name)} is ${esc(inst.version)} ${loaderLabel(inst.loader)}. Create a HUD-ready instance in one click.</div></div><button class="btn primary sm" data-act="hud-quick">${ic('plus')}Create 26.3 instance</button></div>`
      : !installed ? `<div class="banner">${ic('zap')}<div class="grow"><b>Lumen HUD is not installed in ${esc(inst.name)}.</b><div class="small muted">Installs the mod plus Fabric API. Your layout below is kept.</div></div><button class="btn primary sm" data-act="hud-install">${ic('download')}Install Lumen HUD</button></div>` : ''}
    <div class="hud-wrap">
      <div>
        <div class="hud-stage" id="hud-stage" style="background-image:url('${esc(bg || '')}')">
          <div class="hud-canvas" id="hud-canvas">
            <div class="mc-cross"></div>
            <div class="mc-hotbar">${'<i></i>'.repeat(9)}</div>
          </div>
        </div>
        <div class="row small muted nowrap" style="margin-top:10px;gap:16px">
          <span>${ic('move').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Drag to move</span><span>Scroll to resize</span><span>Right-click to hide</span>
          <span class="grow"></span><span>Preview: 1280×720, GUI scale 3</span>
        </div>
      </div>
      <div id="hud-panel" class="hud-panel"></div>
    </div>`;
  hudFit();
  hudRenderPreview();
  hudRenderPanel();
  hudBindStage();
  requestAnimationFrame(() => { hudFit(); hudLayout(); });
};

const fmtBytes = (b) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : b >= 1048576 ? `${Math.round(b / 1048576)} MB` : `${Math.max(0, Math.round(b / 1024))} KB`);

async function paintStorage() {
  const box = $('#storage-box');
  if (!box) return;
  let u;
  try { u = await api.call('storage:usage'); } catch (e) { if (box.isConnected) box.innerHTML = `<span class="small muted">Could not measure: ${esc(e.message)}</span>`; return; }
  if (!box.isConnected) return; // the user left Settings while we were measuring
  const cleanable = u.unused.bytes > 0;
  box.innerHTML = `<div class="small" style="display:flex;justify-content:space-between;margin-bottom:6px"><b>Total</b><b>${fmtBytes(u.total)}</b></div>
    ${u.parts.map((p) => `<div class="small muted" style="display:flex;justify-content:space-between"><span>${esc(p.label)}</span><span>${fmtBytes(p.bytes)}</span></div>`).join('')}
    ${cleanable ? `<div class="row" style="margin-top:10px;gap:10px"><div class="grow small muted">${u.unused.versions.length ? `${u.unused.versions.length} unused version${u.unused.versions.length === 1 ? '' : 's'} (${esc(u.unused.versions.map((v) => v.id).slice(0, 3).join(', '))}${u.unused.versions.length > 3 ? '…' : ''})` : ''}${u.unused.versions.length && u.unused.runtimes.length ? ' and ' : ''}${u.unused.runtimes.length ? `${u.unused.runtimes.length} unused Java runtime${u.unused.runtimes.length === 1 ? '' : 's'}` : ''}. They are downloaded again if you ever need them.</div>
      <button class="btn sm" data-act="storage-clean">Free ${fmtBytes(u.unused.bytes)}</button></div>`
      : '<div class="small muted" style="margin-top:8px">Nothing unused to clean up.</div>'}`;
}

// ---------------- modals ----------------
async function loadVersions() {
  const snap = !!S.cfg.settings.showSnapshots;
  if (!S.versions[snap]) S.versions[snap] = await api.call('versions:list', snap);
  if (!S.fabricVersions) S.fabricVersions = new Set(await api.call('versions:fabric'));
  return S.versions[snap];
}

async function instanceModal(existing) {
  const m = modal(`<h2>${existing ? 'Edit instance' : 'New instance'}</h2><p class="sub">${existing ? 'Change version, loader or memory.' : 'Pick a version — Lumen downloads everything on first launch.'}</p><div class="loading"><span class="spinner"></span></div>`);
  let versions;
  try { versions = await loadVersions(); } catch (e) { m.close(); return toast(`Could not load versions: ${e.message}`, 'err'); }
  const inst = existing || { name: '', version: versions[0].id, loader: 'fabric', color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  let loader = inst.loader;
  let color = instColor(inst.id ? inst : { ...inst, id: 'x' });
  if (!existing && !S.fabricVersions.has(inst.version)) inst.version = (versions.find((v) => S.fabricVersions.has(v.id)) || versions[0]).id;

  const opts = () => versions
    .filter((v) => loader === 'vanilla' || S.fabricVersions.has(v.id))
    .map((v) => `<option value="${v.id}" ${v.id === inst.version ? 'selected' : ''}>${v.id}${v.type === 'snapshot' ? ' (snapshot)' : ''}</option>`).join('');

  m.querySelector('.modal').innerHTML = `
    <h2>${existing ? 'Edit instance' : 'New instance'}</h2><p class="sub">${existing ? 'Change version, loader or memory.' : 'Pick a version — Lumen downloads everything on first launch.'}</p>
    <form class="form" id="inst-form">
      <label class="field">Name<input class="input" name="name" value="${esc(inst.name)}" placeholder="My survival world" required maxlength="40"></label>
      <div class="row" style="align-items:flex-end">
        <label class="field grow">Minecraft version<select class="input" name="version" id="ver">${opts()}</select></label>
        <div class="field"><span style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;display:block">Loader</span>
          <div class="seg" id="loader"><button type="button" data-l="fabric" class="${loader === 'fabric' ? 'on' : ''}">Fabric</button><button type="button" data-l="vanilla" class="${loader === 'vanilla' ? 'on' : ''}">Vanilla</button></div></div>
      </div>
      <div class="field"><span>Colour</span><div class="colors">${COLORS.map((c) => `<button type="button" data-c="${c}" class="${c === color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
      ${existing ? `
        <label class="field"><span>RAM override (MB) <span class="dim" style="font-weight:400">— empty = global (${S.cfg.settings.ram} MB)</span></span><input class="input" name="ram" type="number" step="512" min="1024" value="${existing.ram || ''}"></label>
        ${(() => {
          const rec = recommendRam(Object.values(existing.content).filter((e) => e.type === 'mod' && e.enabled !== false).length, S.sys.totalMem);
          const cur = existing.ram || S.cfg.settings.ram;
          return rec === cur ? `<div class="small muted">${(rec / 1024).toFixed(rec % 1024 ? 1 : 0)} GB is a good amount for this many mods.</div>`
            : `<div class="row small" style="gap:8px"><span class="muted">Recommended for this many mods: <b style="color:var(--text)">${(rec / 1024).toFixed(rec % 1024 ? 1 : 0)} GB</b></span><button type="button" class="btn sm" data-rec="${rec}">Use ${(rec / 1024).toFixed(rec % 1024 ? 1 : 0)} GB</button></div>`;
        })()}
        <label class="field">Extra JVM arguments<input class="input" name="jvmArgs" value="${esc(existing.jvmArgs || '')}"></label>`
      : `<label class="opt card" style="padding:12px 14px;cursor:pointer"><div><div class="k">Install Lumen essentials</div><div class="d">Sodium, Lithium, Zoom, Mod Menu and other performance modules.</div></div><input type="checkbox" name="preset" checked style="width:18px;height:18px;accent-color:var(--accent)"></label>`}
      <div class="foot"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">${existing ? 'Save' : `${ic('plus')}Create`}</button></div>
    </form>`;

  const form = m.querySelector('#inst-form');
  const presetRow = form.querySelector('[name=preset]');
  m.querySelector('#loader').addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    loader = b.dataset.l;
    inst.version = form.version.value;
    m.querySelectorAll('#loader button').forEach((x) => x.classList.toggle('on', x === b));
    form.version.innerHTML = opts();
    if (presetRow) presetRow.closest('label').style.display = loader === 'fabric' ? '' : 'none';
  });
  const recBtn = m.querySelector('[data-rec]');
  if (recBtn) recBtn.addEventListener('click', () => { form.ram.value = recBtn.dataset.rec; recBtn.disabled = true; });
  m.querySelector('.colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    color = b.dataset.c;
    m.querySelectorAll('.colors button').forEach((x) => x.classList.toggle('on', x === b));
  });
  m.querySelector('[data-cancel]').onclick = () => m.close();
  let submitting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return; // spamming Create used to make duplicate instances
    submitting = true;
    form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const data = { name: form.name.value.trim(), version: form.version.value, loader, color };
    try {
      if (existing) {
        data.ram = +form.ram.value || null;
        data.jvmArgs = form.jvmArgs.value.trim();
        if (data.version !== existing.version && Object.keys(existing.content).length && data.loader === existing.loader) {
          // Mods built for the old version would stop the game from starting: show what will happen to each one.
          const plan = await api.call('instances:migratePlan', existing.id, data.version);
          if (!(await migrateConfirm(existing, plan))) {
            submitting = false;
            form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            return;
          }
          const { version, ...rest } = data;
          await api.call('instances:update', existing.id, { ...rest, version: existing.version });
          m.close();
          const rep = await runTask(`Moving to ${version}`, () => api.call('instances:migrate', existing.id, version));
          await refreshInstances();
          S.updates = null; S.updateMap = {}; S.hud = null; S.modules = null;
          render();
          const parts = [`${rep.updated.length} updated`];
          if (rep.disabled.length) parts.push(`${rep.disabled.length} switched off (no ${version} build): ${rep.disabled.join(', ')}`);
          toast(`Moved to ${version} · ${parts.join(' · ')}`, rep.disabled.length ? '' : 'ok');
          return;
        }
        await api.call('instances:update', existing.id, data);
        m.close();
        await refreshInstances();
        render();
      } else {
        const created = await api.call('instances:create', data);
        m.close();
        await saveCfg({ selectedInstance: created.id });
        await refreshInstances();
        render();
        toast(`Created ${created.name}`, 'ok');
        if (presetRow && presetRow.checked && loader === 'fabric') enablePreset();
      }
    } catch (err) {
      toast(err.message, 'err');
      submitting = false; // let the user fix the problem and try again
      form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  });
}

// Preview of what changing the Minecraft version does to the instance's mods. Resolves true to go ahead.
function migrateConfirm(inst, plan) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const names = (a) => a.slice(0, 6).map((x) => esc(x.title)).join(', ') + (a.length > 6 ? `, +${a.length - 6} more` : '');
    const rows = [];
    if (plan.ok.length) rows.push(`<b>${plan.ok.length} will be updated</b> to builds for ${esc(plan.version)}<br><span class="muted">${names(plan.ok)}</span>`);
    if (plan.missing.length) rows.push(`<span style="color:var(--warn)"><b>${plan.missing.length} will be switched off</b></span> — no build for ${esc(plan.version)} yet<br><span class="muted">${names(plan.missing)}</span>`);
    if (plan.hud === 'remove') rows.push(`<span style="color:var(--warn)"><b>Lumen HUD will be removed</b></span> — it isn't available for ${esc(plan.version)} yet`);
    if (!rows.length) rows.push('Nothing in this instance needs to change.');
    const m = modal(`<h2>Move ${esc(inst.name)} to ${esc(plan.version)}?</h2><p class="sub">Mods built for ${esc(inst.version)} would stop the game from starting, so they are updated for you. Your worlds are not touched.</p>${docRows(rows)}
      <div class="foot"><button class="btn ghost" data-r="no">Cancel</button><button class="btn primary" data-r="yes">${ic('check')}Move & update mods</button></div>`, { onClose: () => finish(false) });
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      finish(b.dataset.r === 'yes');
      m.close();
    });
  });
}

function pickInstance() {
  const sel = cur();
  const m = modal(`<h2>Select instance</h2><p class="sub">Used for Play, modules, browsing and servers.</p>
    <div class="picker-list">${S.instances.map((i) => `<button data-id="${i.id}" class="${sel && sel.id === i.id ? 'on' : ''}">${instIcon(i, 36)}<div class="grow"><b data-nt>${esc(i.name)}</b><div class="small muted">${esc(i.version)} · ${loaderLabel(i.loader)}</div></div></button>`).join('')}</div>
    <div class="foot"><button class="btn" data-new>${ic('plus')}New instance</button></div>`);
  m.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new]')) { m.close(); return instanceModal(); }
    const b = e.target.closest('[data-id]');
    if (!b) return;
    m.close();
    await saveCfg({ selectedInstance: b.dataset.id });
    S.updates = null;
    render();
  });
}

function welcome() {
  const m = modal(`
    <div style="text-align:center;padding:10px 0 4px">
      <div class="logo" style="width:46px;height:46px;margin:0 auto 18px;border-radius:14px"></div>
      <h2 style="font-size:26px">Welcome to Lumen</h2>
      <p class="sub">A fast Minecraft client with one-click modules. Pick a nickname to get started.</p>
    </div>
    <form class="form" id="welcome">
      <input class="input" name="name" placeholder="Nickname" maxlength="16" required autofocus style="height:46px;font-size:16px;text-align:center">
      ${S.instances.length ? '' : `<label class="opt card" style="padding:12px 14px;cursor:pointer"><div><div class="k">Create a ready-to-play instance</div><div class="d">Latest version on Fabric with Lumen essentials.</div></div><input type="checkbox" name="quick" checked style="width:18px;height:18px;accent-color:var(--accent)"></label>`}
      <button class="btn primary" style="height:46px;font-size:15px">Get started</button>
    </form>`);
  const form = m.querySelector('#welcome');
  form.name.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      S.cfg = await api.call('accounts:addOffline', form.name.value.trim());
      const quick = form.quick && form.quick.checked;
      m.close();
      render();
      if (quick) {
        const versions = await loadVersions();
        const v = versions.find((x) => x.type === 'release' && S.fabricVersions.has(x.id));
        const created = await api.call('instances:create', { name: `Lumen ${v.id}`, version: v.id, loader: 'fabric', color: S.cfg.settings.accent });
        await saveCfg({ selectedInstance: created.id });
        await refreshInstances();
        render();
        enablePreset();
      }
    } catch (err) { toast(err.message, 'err'); }
  });
}

async function enablePreset() {
  const inst = cur();
  if (!S.modules) S.modules = await api.call('modules:list');
  const todo = S.modules.filter((m) => m.preset && m.id && !inst.content[m.id] && (m.builtin ? hudSupports(inst.version) : !m.gameVersions || m.gameVersions.includes(inst.version)));
  if (!todo.length) return toast('Essentials already enabled');
  todo.forEach((m) => S.busy.add(m.slug));
  if (S.view === 'modules') render();
  const failed = [];
  await runTask('Installing Lumen essentials', async (t) => {
    for (const [i, m] of todo.entries()) {
      t.status = `${m.name} (${i + 1}/${todo.length})`;
      renderDock();
      try { await api.call('content:install', inst.id, m.slug, 'mod', m.slug); } catch { failed.push(m.name); }
      S.busy.delete(m.slug);
      await refreshInstances();
      if (S.view === 'modules' || S.view === 'home') render();
    }
  });
  toast(failed.length ? `Essentials installed, skipped: ${failed.join(', ')}` : 'Lumen essentials enabled', failed.length ? '' : 'ok');
}

function lightbox(p) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${esc(fileUrl(p))}"><div class="bar">
    <button class="btn" data-copy>${ic('copy')}Copy</button>
    <button class="btn" data-show>${ic('folder')}Show in folder</button>
    <button class="btn danger" data-del>${ic('trash')}Delete</button></div>`;
  const onKey = (e) => e.key === 'Escape' && close();
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', async (e) => {
    try {
      if (e.target.closest('[data-copy]')) {
        const bytes = await api.call('screenshots:read', p);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
        toast('Screenshot copied', 'ok');
      }
      else if (e.target.closest('[data-show]')) await api.call('shell:show', p);
      else if (e.target.closest('[data-del]')) {
        await api.call('screenshots:delete', p);
        close();
        toast('Moved to the Recycle Bin');
        if (S.view === 'screenshots') render();
      } else close();
    } catch (err) { toast(err.message, 'err'); }
  });
  document.body.appendChild(el);
}

// ---------------- actions ----------------
const ACTIONS = {
  nav: (d) => nav(d.v),
  play: (d) => launch(d.id),
  kill: () => api.call('game:kill'),
  join: (d) => cur() && launch(cur().id, d.addr),
  'new-instance': () => instanceModal(),
  'edit-instance': (d) => instanceModal(S.instances.find((i) => i.id === d.id)),
  'duplicate-instance': (d) => {
    const src = S.instances.find((i) => i.id === d.id);
    const m = modal(`<h2>Duplicate ${esc(src.name)}</h2><p class="sub">A copy with the same version, mods and settings, to experiment on safely.</p>
      <form class="form" id="dup-form">
        <label class="field">Name<input class="input" name="name" value="${esc(`${src.name} (copy)`)}" maxlength="40" required></label>
        <label class="opt card" style="padding:12px 14px;cursor:pointer"><div><div class="k">Copy worlds too</div><div class="d">Off by default: worlds can be large.</div></div><input type="checkbox" name="worlds" style="width:18px;height:18px;accent-color:var(--accent)"></label>
        <div class="foot"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn primary">${ic('copy')}Duplicate</button></div>
      </form>`);
    const form = m.querySelector('#dup-form');
    form.name.select();
    m.querySelector('[data-cancel]').onclick = () => m.close();
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const name = form.name.value.trim();
      const worlds = form.worlds.checked;
      m.close();
      try {
        const copy = await runTask('Duplicating instance', () => api.call('instances:duplicate', src.id, name, worlds));
        await refreshInstances();
        toast(`Created ${copy.name}`, 'ok');
        render();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  },
  'pick-instance': () => pickInstance(),
  'select-instance': async (d) => { await saveCfg({ selectedInstance: d.id }); S.updates = null; render(); },
  'open-instance': (d) => api.call('instances:open', d.id, d.sub),
  'delete-instance': async (d) => {
    const i = S.instances.find((x) => x.id === d.id);
    if (!(await confirmBox(`Delete ${i.name}?`, 'Worlds, mods and screenshots in this instance will be removed permanently.'))) return;
    try { await api.call('instances:remove', d.id); await refreshInstances(); render(); toast('Instance deleted'); } catch (e) { toast(e.message, 'err'); }
  },
  'to-fabric': async () => {
    const inst = cur();
    await loadVersions();
    if (!S.fabricVersions.has(inst.version)) return toast(`Fabric does not support ${inst.version}`, 'err');
    await api.call('instances:update', inst.id, { loader: 'fabric' });
    await refreshInstances();
    S.browse.key = '';
    render();
    toast('Switched to Fabric', 'ok');
  },
  'module-cat': (d) => { S.moduleCat = d.c; render(); },
  'module-toggle': async (d) => {
    const inst = cur();
    const m = S.modules.find((x) => x.slug === d.slug);
    S.busy.add(m.slug);
    render();
    try {
      if (m.id && inst.content[m.id]) {
        const r = await api.call('content:remove', inst.id, m.id);
        const extra = (r.removed || []).length - 1;
        toast(extra > 0 ? `${m.name} disabled (+${extra} unused ${extra === 1 ? 'dependency' : 'dependencies'} removed)` : `${m.name} disabled`);
      } else {
        const r = await runTask(`Enabling ${m.name}`, () => api.call('content:install', inst.id, m.slug, 'mod', m.slug));
        toast(r.installed.length > 1 ? `${m.name} enabled (+${r.installed.length - 1} dependencies)` : `${m.name} enabled`, 'ok');
      }
      await refreshInstances();
    } catch (e) { toast(e.message, 'err'); }
    S.busy.delete(m.slug);
    if (S.view === 'modules') render();
  },
  'enable-preset': () => enablePreset(),
  'enable-iris': () => installProject('iris', 'mod', 'iris').then(() => render()),
  'browse-type': (d) => { S.browse.type = d.t; render(); },
  'browse-more': (d) => { S.browse.type = d.t; nav('browse'); },
  more: () => { S.browse.offset = S.browse.hits.length; doSearch(false); },
  project: (d) => openProject(d.id),
  install: (d) => installProject(d.id, S.browse.type),
  'content-tab': (d) => { S.contentTab = d.t; render(); },
  'content-toggle': async (d, el) => {
    const inst = cur();
    await api.call('content:toggle', inst.id, d.id, !el.classList.contains('on'));
    await refreshInstances();
    render();
  },
  'content-remove': async (d) => {
    const inst = cur();
    const r = await api.call('content:remove', inst.id, d.id);
    const extra = (r.removed || []).length - 1;
    if (extra > 0) toast(`Also removed ${extra} unused ${extra === 1 ? 'dependency' : 'dependencies'}`);
    await refreshInstances();
    render();
  },
  'local-toggle': async (d, el) => { await api.call('content:toggleLocal', cur().id, d.type, d.file, !el.classList.contains('on')); render(); },
  'local-remove': async (d) => {
    if (!(await confirmBox('Remove file?', d.file, 'Remove'))) return;
    await api.call('content:removeLocal', cur().id, d.type, d.file);
    render();
  },
  'check-updates': async () => {
    const inst = cur();
    const list = await runTask('Checking for updates', () => api.call('content:updates', inst.id));
    setUpdates(inst.id, list);
    toast(list.length ? `${list.length} updates available` : 'Everything is up to date', list.length ? '' : 'ok');
    if (S.view === 'content') render();
  },
  'update-one': async (d) => {
    await installProject(d.id, d.type);
    S.updates.list = S.updates.list.filter((u) => u.id !== d.id);
    render();
  },
  'update-all': async () => {
    const inst = cur();
    const list = [...S.updates.list];
    await runTask('Updating', async (t) => {
      for (const [i, u] of list.entries()) {
        t.status = `${u.title} (${i + 1}/${list.length})`;
        renderDock();
        try { await api.call('content:install', inst.id, u.id, u.type); S.updates.list = S.updates.list.filter((x) => x.id !== u.id); } catch (e) { toast(e.message, 'err'); }
      }
    });
    await refreshInstances();
    toast('Updates installed', 'ok');
    render();
  },
  'remove-server': async (d) => { await saveCfg({ servers: S.cfg.servers.filter((_, i) => i !== +d.i) }); render(); },
  'refresh-servers': () => { S.serverStatus = {}; render(); },
  lightbox: (d) => lightbox(d.path),
  'copy-logs': () => { navigator.clipboard.writeText(S.logs.map((l) => l[0]).join('\n')); toast('Logs copied', 'ok'); },
  'clear-logs': () => { S.logs = []; render(); },
  'select-account': async (d) => { await saveCfg({ selectedAccount: d.id }); render(); },
  'remove-account': async (d) => { S.cfg = await api.call('accounts:remove', d.id); render(); },
  'setting-toggle': async (d, el) => { await saveCfg({ settings: { [d.k]: !el.classList.contains('on') } }); render(); },
  accent: async (d) => { await saveCfg({ settings: { accent: d.c } }); applyAccent(); render(); },
  'open-data': () => api.call('shell:openData'),
  'open-log': async () => { if (!(await api.call('app:openLog'))) toast('No errors have been logged yet', 'ok'); },
  'storage-clean': async () => {
    const r = await api.call('storage:clean');
    toast(r.removed.length ? `Freed ${fmtBytes(r.freed)}` : 'Nothing to clean up', 'ok');
    paintStorage();
  },
  'open-logs': () => {
    const id = S.game.instId || (cur() && cur().id);
    if (id) return api.call('instances:open', id, 'logs');
  },
  'pack-use': async (d) => {
    const inst = cur();
    const turnOn = d.on === '1';
    if (turnOn && d.type === 'shader' && !Object.values(inst.content).some((e) => e.slug === 'iris' && e.enabled !== false)) {
      if (!(await confirmBox('Shaders need Iris', 'Iris is the mod that loads shader packs. Install it now?', 'Install Iris'))) return;
      await installProject('iris', 'mod', 'iris');
      if (!cur().content || !Object.values(cur().content).some((e) => e.slug === 'iris')) return; // install failed; it already said why
    }
    await api.call('content:use', inst.id, d.type, d.file, turnOn);
    toast(turnOn ? `${d.file} is now active in ${inst.name}` : `${d.file} switched off`, 'ok');
    render();
  },
  'pack-install': (d) => installPack(d.id),
  'pack-more': () => { S.packs.offset = S.packs.hits.length; searchPacks(false); },
  'pack-import': async () => {
    const file = await api.call('pack:pickImport');
    if (!file) return;
    adoptInstance(await runTask('Importing modpack', () => api.call('pack:import', file)), 'Imported');
  },
  'export-pack': async (d) => {
    const file = await api.call('pack:pickExport', d.id);
    if (!file) return;
    const r = await runTask('Exporting modpack', () => api.call('pack:export', d.id, file));
    toast(`Exported ${r.files} mods${r.bundled ? ` and ${r.bundled} bundled files` : ''}`, 'ok');
  },
  'hud-select': (d) => {
    S.hud.sel = d.id;
    hudRenderPanel();
    document.querySelectorAll('#hud-canvas .hel').forEach((n) => n.classList.toggle('sel', n.dataset.id === d.id));
  },
  'hud-el-toggle': (d) => {
    const e = S.hud.cfg.elements[d.k];
    e.enabled = !e.enabled;
    hudRenderPreview();
    hudRenderPanel();
    hudSave();
  },
  'hud-opt': (d) => {
    S.hud.cfg[d.k] = !S.hud.cfg[d.k];
    hudRenderPreview();
    hudRenderPanel();
    hudSave();
  },
  'hud-preset': (d) => {
    const pr = S.hudInfo.presets[d.k];
    if (!pr) return;
    S.hud.cfg.theme = pr.theme;
    for (const [id, e] of Object.entries(S.hud.cfg.elements)) e.enabled = pr.on.includes(id);
    hudRenderPreview();
    hudRenderPanel();
    hudSave();
  },
  'hud-theme': (d) => {
    S.hud.cfg.theme = d.k;
    hudRenderPreview();
    hudRenderPanel();
    hudSave();
  },
  'hud-color': (d) => {
    S.hud.cfg[d.k] = d.c;
    hudRenderPreview();
    hudRenderPanel();
    hudSave();
  },
  'hud-reset': async () => {
    if (!(await confirmBox('Reset Lumen HUD?', 'Positions, sizes and colours go back to defaults.', 'Reset'))) return;
    S.hud.cfg = await api.call('hud:reset', S.hud.instId);
    hudRenderPreview();
    hudRenderPanel();
  },
  'hud-install': async () => {
    await installProject('lumen-hud', 'mod', 'lumen-hud');
    render();
  },
  'hud-quick': async () => {
    await loadVersions();
    const created = await api.call('instances:create', { name: 'Lumen 26.3', version: '26.3', loader: 'fabric', color: S.cfg.settings.accent });
    await saveCfg({ selectedInstance: created.id });
    await refreshInstances();
    S.hud = null;
    render();
    await enablePreset();
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.closest('.modal-wrap')) return;
  // Keyboard activation (Enter/Space) can still reach buttons behind an open modal; ignore it.
  if (document.querySelector('.modal-wrap')) return;
  e.stopPropagation();
  const fn = ACTIONS[el.dataset.act];
  if (fn) Promise.resolve(fn(el.dataset, el, e)).catch((err) => toast(err.message, 'err'));
});

// ---------------- events from main ----------------
api.onProgress((p) => {
  S.progress = p;
  const el = $('#progress');
  if (document.querySelector('.progress')) paintProgress();
  else if (el && S.view === 'home') el.innerHTML = progressHtml();
  else renderDock();
});

api.onState(async (s) => {
  const prev = S.game.state;
  S.game = s;
  if (s.state === 'idle' && prev === 'running' && s.code && s.code !== 0) toast(`Game exited with code ${s.code} — check the Console`, 'err');
  if (s.state === 'idle') await refreshInstances();
  if (['home', 'instances', 'console', 'servers'].includes(S.view)) render();
  else { renderNav(); renderDock(); }
});

api.onLog((line, level) => {
  S.logs.push([line, level]);
  if (S.logs.length > 4000) S.logs.splice(0, S.logs.length - 4000);
  const c = S.view === 'console' && $('#console');
  if (c) {
    if (!c.querySelector('div')) c.innerHTML = ''; // drop the "no output yet" placeholder
    if (logMatches(line)) {
      const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
      const div = document.createElement('div');
      div.className = logClass(line, level);
      div.textContent = line;
      c.appendChild(div);
      while (c.childElementCount > 4000) c.firstElementChild.remove(); // keep the DOM as bounded as the log buffer
      if (stick) c.scrollTop = c.scrollHeight;
    }
  } else if (S.view !== 'console' && level !== 'out') {
    S.unread++;
  }
});

// ---------------- drag & drop ----------------
// Dropping files must always be intercepted: otherwise the window navigates to the dropped file and the app is gone.
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
function showDrop(on) {
  const dz = $('#dropzone');
  if (on) $('#dz-title').textContent = cur() ? `Drop files to add them to ${cur().name}` : 'Drop a modpack (.mrpack) to import it';
  dz.classList.toggle('on', on);
}
document.addEventListener('dragenter', (e) => { if (hasFiles(e)) { e.preventDefault(); dragDepth++; showDrop(true); } });
document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) showDrop(false);
});
document.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  showDrop(false);
  // Files that don't live on disk (dragged out of a browser, say) have no path; skip those quietly.
  handleDrop([...e.dataTransfer.files].map((f) => { try { return api.pathOf(f); } catch { return ''; } }).filter(Boolean));
});

async function handleDrop(files) {
  const packFiles = files.filter((p) => /\.mrpack$/i.test(p));
  const rest = files.filter((p) => !/\.mrpack$/i.test(p));
  for (const p of packFiles) {
    try { await adoptInstance(await runTask('Importing modpack', () => api.call('pack:import', p)), 'Imported'); } catch (e) { toast(e.message, 'err'); }
  }
  if (!rest.length) return;
  const inst = cur();
  if (!inst) return toast('Create an instance first, then drop the files again', 'err');
  try {
    const r = await api.call('content:addFiles', inst.id, rest, S.view === 'content' ? S.contentTab : undefined);
    await refreshInstances();
    if (r.added.length) toast(`Added ${r.added.map((a) => a.file).join(', ')} to ${inst.name}`, 'ok');
    for (const x of r.rejected) toast(`${x.file} ${x.reason}`, 'err');
    if (['content', 'modules'].includes(S.view)) render();
  } catch (e) {
    toast(e.message, 'err');
  }
}

api.onError((msg) => toast(`Something went wrong: ${msg}. Details are in launcher.log (Settings → Storage).`, 'err'));
api.onProblem((p) => (p.kind === 'oom' ? oomModal(p) : doctorAfter(p)));
api.onCrash((c) => crashModal(c));

api.onTask((text) => {
  const t = S.tasks[S.tasks.length - 1];
  if (t) { t.status = text; renderDock(); }
});

// ---------------- boot ----------------
document.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => api.win(b.dataset.win)));
$('#account-chip').addEventListener('click', () => (account() ? nav('settings') : welcome()));

(async () => {
  S.cfg = await api.call('config:get');
  S.sys = await api.call('sys:info');
  S.instances = await api.call('instances:list');
  S.game = await api.call('game:state');
  S.hudInfo = await api.call('hud:info');
  I18N.init(S.cfg.settings.language, S.sys.locale, window.LUMEN_PACKS || {}); // before the first render
  applyAccent();
  S.enter = true;
  render();
  if (!S.cfg.accounts.length) welcome();
})();
