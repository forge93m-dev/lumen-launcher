// The Skin page: the active skin is drawn (front view), switching model and going back to the default work.
const h = require('./harness');

h.run('Skin page', async ({ js, wait, check }) => {
  await js("nav('skin')");
  await wait(1500);
  const state = () => js(`(() => {
    const cv = document.querySelector('.skin-stage canvas');
    let painted = 0;
    if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) painted++; }
    return { canvases: document.querySelectorAll('canvas[data-skin]').length, painted, tiles: document.querySelectorAll('.skin-tile').length,
      slim: !!document.querySelector('[data-act=skin-model][data-k=slim].on'), none: !!document.querySelector('.skin-none') };
  })()`);
  let s = await state();
  const classicPainted = s.painted;
  check('the active skin and its tile are drawn', s.canvases === 2 && s.tiles === 1 && s.painted > 2000, JSON.stringify(s));
  await js("document.querySelector('[data-act=skin-model][data-k=slim]').click()");
  await wait(600);
  s = await state();
  check('choosing the slim model is kept', s.slim, JSON.stringify(s));
  const slimPainted = s.painted;
  check('slim arms are drawn thinner (two arms, one pixel column each)', classicPainted - slimPainted === 2 * 12 * 100, `${classicPainted} -> ${slimPainted}`);
  await js("document.querySelector('[data-act=skin-default]').click()");
  await wait(600);
  s = await state();
  check('"use the default skin" switches the custom skin off', s.none && s.painted === 0, JSON.stringify(s));
}, {
  setup({ store }) {
    store.addOfflineAccount('Tester');
    const png = require('../../core/png');
    const skins = require('../../core/skins');
    const rgba = Buffer.alloc(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) rgba.set([40 + x * 3, 90 + y * 2, 200 - x, 255], (y * 64 + x) * 4);
    skins.add(png.encode(rgba, 64, 64), { name: 'Test skin' });
  },
});
