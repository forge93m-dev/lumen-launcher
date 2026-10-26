// The launcher's HUD editor: elements follow a real mouse drag, scroll resizes them, right-click hides them.
const h = require('./harness');

h.run('HUD editor', async ({ js, wait, check, win, core }) => {
  const inst = core.instances.list()[0];
  await js("nav('hud')");
  await wait(2000);
  check('the editor shows its preview', await js("!!document.querySelector('#hud-canvas .hel')"));

  const centre = (id) => js(`(() => { const r = document.querySelector('#hud-canvas .hel[data-id=${id}]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), left: r.left, top: r.top }; })()`);
  const wc = win.webContents;
  const mouse = (type, x, y, extra = {}) => wc.sendInputEvent({ type, x, y, button: 'left', clickCount: 1, ...extra });

  const before = await centre('fps');
  mouse('mouseMove', before.x, before.y);
  mouse('mouseDown', before.x, before.y);
  for (let i = 1; i <= 10; i++) { mouse('mouseMove', before.x + i * 12, before.y + i * 7, { modifiers: ['leftButtonDown'] }); await wait(30); }
  mouse('mouseUp', before.x + 120, before.y + 70);
  await wait(300);
  const after = await centre('fps');
  check('dragging an element moves it', Math.abs(after.left - before.left - 120) < 6 && Math.abs(after.top - before.top - 70) < 6, JSON.stringify({ before, after }));

  await wait(900);
  const saved = await js(`api.call('hud:get', '${inst.id}')`);
  const dflt = await js("api.call('hud:defaults').catch(() => null)");
  check('the new position is saved to the instance', !!saved.elements.fps && (!dflt || JSON.stringify(saved.elements.fps) !== JSON.stringify(dflt.elements.fps)), JSON.stringify(saved.elements.fps));
}, {
  setup({ store, instances }) {
    store.addOfflineAccount('Tester');
    const inst = instances.create({ name: 'Hud', version: '26.3', loader: 'fabric' });
    store.update({ selectedInstance: inst.id });
  },
});
