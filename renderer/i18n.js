// Interface language. English is the source text; a language pack maps it to another language and the result
// is applied to the finished page (text, placeholders, tooltips), including toasts, dialogs and anything added later.
// Anything without a translation simply stays English, so a gap in a pack never breaks the UI.
(function (root) {
  'use strict';

  // Russian has three plural forms: 1 мод, 2 мода, 5 модов.
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  // pack: { dict: { 'English text': 'Перевод' }, patterns: [[/^regex$/, 'replacement with $1' | (…groups) => string]] }
  function createTranslator(pack) {
    const dict = Object.assign(Object.create(null), pack.dict || {});
    const patterns = pack.patterns || [];
    // -> translated text (keeping surrounding whitespace) or null when there is nothing to translate it to.
    const translate = function translate(text) {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
      if (!m[2]) return null;
      const core = m[2].replace(/\s+/g, ' ');
      let out = dict[core];
      if (out === undefined) {
        for (const [re, rep] of patterns) {
          const x = re.exec(core);
          if (!x) continue;
          out = typeof rep === 'function' ? rep(...x.slice(1)) : core.replace(re, rep);
          break;
        }
      }
      return out === undefined ? null : m[1] + out + m[3];
    };
    if (typeof pack.bind === 'function') pack.bind(translate); // lets a pattern translate the pieces inside it
    return translate;
  }

  // Text that should stay as written: what the user typed (names), the game's own log, Minecraft's text in the HUD preview.
  const SKIP = '#console, .brand, script, style, textarea, input, [data-nt], .hel, .hbox, .hkeys, .logo, .news-card h4, .news-card p, .result .body > h4, .result .by, .result .body > p';
  const HAS_WORDS = /[A-Za-z]{3}/;
  const CYRILLIC = /[Ѐ-ӿ]/;

  const state = { lang: 'en', missing: new Set(), translate: null };

  function resolve(setting, systemLocale) {
    if (setting === 'ru' || setting === 'en') return setting;
    return /^(ru|uk|be)\b/i.test(systemLocale || '') ? 'ru' : 'en'; // Auto: follow the system
  }

  function startDom(translate) {
    const missing = state.missing;
    const textOf = (node) => {
      const p = node.parentElement;
      if (!p || p.closest(SKIP)) return;
      const t = translate(node.nodeValue);
      if (t === null) {
        const core = node.nodeValue.trim().replace(/\s+/g, ' ');
        // Text that already has Cyrillic in it is a translation (or a name next to one), not a gap.
        if (core && HAS_WORDS.test(core) && !CYRILLIC.test(core)) missing.add(core);
      } else if (t !== node.nodeValue) {
        node.nodeValue = t;
      }
    };
    // An input's placeholder is interface text even though its value (what the user typed) is not.
    const SKIP_ATTR = SKIP.replace(', textarea, input', '');
    const attrsOf = (el) => {
      if (el.closest && el.closest(SKIP_ATTR)) return;
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute && el.getAttribute(a);
        if (!v) continue;
        const t = translate(v);
        if (t === null) { if (HAS_WORDS.test(v) && !CYRILLIC.test(v)) missing.add(v); } else if (t !== v) el.setAttribute(a, t);
      }
    };
    const walk = (node) => {
      if (node.nodeType === 3) return textOf(node);
      if (node.nodeType !== 1) return;
      attrsOf(node);
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === 3) textOf(n);
        else attrsOf(n);
      }
    };
    let pending = [];
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const batch = pending;
      pending = [];
      for (const m of batch) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') textOf(m.target);
        else if (m.type === 'attributes') attrsOf(m.target);
      }
    };
    new MutationObserver((muts) => {
      pending.push(...muts);
      if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title'] });
    walk(document.body);
    return flush;
  }

  // Call once at start-up, before the first render. `pack` is the language pack for `lang`.
  function init(setting, systemLocale, packs) {
    state.lang = resolve(setting, systemLocale);
    document.documentElement.lang = state.lang;
    if (state.lang === 'en' || !packs[state.lang]) return state.lang;
    state.translate = createTranslator(packs[state.lang]);
    state.flush = startDom(state.translate);
    return state.lang;
  }

  const api = {
    init, resolve, createTranslator, plural,
    get lang() { return state.lang; },
    // English strings that appeared on screen without a translation (for development and the tests).
    missing: () => [...state.missing].sort(),
    // Translates one string on demand, e.g. for text that is built in code.
    t: (text) => (state.translate && state.translate(text)) || text,
    SKIP,
  };
  root.I18N = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
