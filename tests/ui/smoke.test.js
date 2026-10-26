// Every page renders at the smallest window size without errors or sideways scrolling, in both languages,
// and spamming buttons does not replay animations or stack dialogs.
const h = require('./harness');

const pages = ['home', 'instances', 'modules', 'hud', 'skin', 'browse', 'modpacks', 'content', 'servers', 'screenshots', 'console', 'settings'];
const pageAnimations = "document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.classList&&a.effect.target.classList.contains('page')).length";

h.run('Smoke test', async ({ js, wait, check, win, core }) => {
  win.setSize(1000, 640);
  const { instances: I } = core;
  const inst = I.list()[0];

  for (const lang of ['en', 'ru']) {
    await js(`(async () => { await saveCfg({ settings: { language: '${lang}' } }); })()`);
    win.webContents.reload();
    await wait(3500);
    for (const v of pages) {
      await js(`nav('${v}')`);
      await wait(['modules', 'browse', 'modpacks'].includes(v) ? 4500 : 1500);
      const info = await js("({ sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth, errs: (window.__errs || []).splice(0), toasts: [...document.querySelectorAll('.toast.err')].map(t => t.textContent) })");
      check(`[${lang}] "${v}" renders at 1000x640 without errors`, !info.sideways && !info.errs.length && !info.toasts.length, JSON.stringify(info));
    }
  }

  // spamming a navigation button must not replay the page transition
  await js("nav('home')"); await wait(500);
  check('spamming the current navigation button does not replay the transition', (await js(`(() => { for (let i = 0; i < 6; i++) document.querySelector('[data-v=home]').click(); return ${pageAnimations}; })()`)) === 0);
  await js("nav('instances')"); await wait(500);
  check('a plain re-render does not replay it either', (await js(`(() => { render(); return ${pageAnimations}; })()`)) === 0);
  check('going to another page does play it once', (await js(`(() => { nav('home'); return ${pageAnimations}; })()`)) === 1);

  // spamming "New instance" opens one dialog, not a stack
  await js("nav('instances')"); await wait(500);
  await js("(() => { const b = document.querySelector('.new-card'); for (let i = 0; i < 6; i++) b.click(); })()");
  await wait(3000);
  check('spamming "New instance" opens exactly one dialog', (await js("document.querySelectorAll('.modal-wrap').length")) === 1);
  await js("document.querySelectorAll('.modal-wrap').forEach(m => m.remove())");

  // the same message shown again does not stack copies
  await js("(() => { for (let i = 0; i < 5; i++) toast('Same message'); })()");
  check('repeating one message shows it once', (await js("document.querySelectorAll('#toasts .toast').length")) === 1);

  // typing in the Installed filter keeps focus and does not replay animations
  await js("nav('content')"); await wait(1500);
  const typed = await js(`(() => { const i = document.querySelector('#content-q'); i.focus(); i.value = 'a'; i.dispatchEvent(new Event('input')); return { focus: document.activeElement.id === 'content-q', anims: ${pageAnimations} }; })()`);
  check('typing in the Installed filter keeps focus without flicker', typed.focus && typed.anims === 0, JSON.stringify(typed));
  check('the launcher knows its instance', !!inst);
}, {
  setup({ store, instances }) {
    store.addOfflineAccount('Tester');
    const inst = instances.create({ name: 'Smoke', version: '26.3', loader: 'fabric' });
    store.update({ selectedInstance: inst.id });
  },
});
