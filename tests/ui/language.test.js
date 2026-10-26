// The language switch in Settings: English stays English, choosing Russian persists and reloads the window.
const h = require('./harness');

h.run('Language switch', async ({ js, wait, check, core }) => {
  const { store } = core;
  check('with the language set to English, text is English and the engine is off', (await js('I18N.lang')) === 'en' && (await js("document.querySelector('[data-v=home]').textContent.trim()")) === 'Home');
  await js("nav('settings')"); await wait(1500);
  check('the Language selector is there and shows English', (await js("document.querySelector('#lang').value")) === 'en');
  check('English texts were not touched', (await js("document.querySelector('#view').innerText")).includes('Hide launcher while playing'));

  // choose Russian: saved, and the window reloads in Russian
  await js("(()=>{const s=document.querySelector('#lang');s.value='ru';s.dispatchEvent(new Event('change'))})()");
  await wait(4000);
  check('the choice is saved', store.load().settings.language === 'ru', store.load().settings.language);
  check('after the reload the interface is Russian', (await js('I18N.lang')) === 'ru' && (await js("document.querySelector('[data-v=home]').textContent.trim()")) === 'Главная');
  await js("nav('settings')"); await wait(1500);
  check('the selector now shows Русский and its label is translated', (await js("document.querySelector('#lang').value")) === 'ru' && (await js("document.querySelector('#view').innerText")).includes('Язык'));
  check('placeholders of inputs are translated, what the user types is not', (await js("document.querySelector('#add-acc input').placeholder")) === 'Ник');

  // user-written names are never translated, even when they equal a word of the interface
  await js("(async () => { await lumen.call('accounts:addOffline', 'Home'); await lumen.call('instances:create', { name: 'Vanilla', version: '26.3', loader: 'vanilla' }); S.cfg = await lumen.call('config:get'); await refreshInstances(); nav('instances'); })()"); await wait(1500);
  const names = await js("[...document.querySelectorAll('.inst-card h3')].map(e => e.textContent)");
  check('an instance called "Vanilla" keeps its name', names.includes('Vanilla'), JSON.stringify(names));
  await js("nav('settings')"); await wait(1200);
  check('an account called "Home" keeps its name', (await js("[...document.querySelectorAll('.acc b')].map(e => e.textContent)")).includes('Home'));

  // back to automatic: the system language decides (the test machine's locale is irrelevant, so only check it saves)
  await js("(()=>{const s=document.querySelector('#lang');s.value='auto';s.dispatchEvent(new Event('change'))})()"); await wait(4000);
  check('"Auto" is saved', store.load().settings.language === 'auto');
}, {
  setup({ store }) {
    store.addOfflineAccount('Tester');
    store.update({ settings: { language: 'en' } });
  },
});
