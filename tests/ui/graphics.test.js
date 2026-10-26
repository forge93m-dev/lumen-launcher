// The Graphics dialog of an instance: it shows the profiles, marks the current one and changes options.txt.
const h = require('./harness');
const fs = require('fs');
const path = require('path');

h.run('Graphics dialog', async ({ js, wait, check, core }) => {
  const inst = core.instances.list()[0];
  const opts = path.join(core.instances.dirOf(inst.id), 'options.txt');
  await js("nav('instances')");
  await wait(1500);
  await js(`document.querySelector('[data-act=instance-graphics][data-id="${inst.id}"]').click()`);
  await wait(800);
  const cards = await js("[...document.querySelectorAll('.gfx-card')].map((c) => c.dataset.profile)");
  check('the four profiles are offered', JSON.stringify(cards) === JSON.stringify(['quality', 'balanced', 'performance', 'potato']), JSON.stringify(cards));
  await js("document.querySelector('.gfx-card[data-profile=potato]').click()");
  await wait(800);
  check('picking a profile marks it', await js("document.querySelector('.gfx-card[data-profile=potato]').classList.contains('on')"));
  check('options.txt got the lowest settings', fs.readFileSync(opts, 'utf8').includes('renderDistance:4'));
  await js("document.querySelector('[data-close]').click()");
  await wait(300);
  check('the dialog closes', !(await js("!!document.querySelector('.modal-wrap')")));
}, {
  setup({ store, instances }) {
    store.addOfflineAccount('Tester');
    const inst = instances.create({ name: 'Gfx', version: '26.3', loader: 'fabric' });
    store.update({ selectedInstance: inst.id });
  },
});
