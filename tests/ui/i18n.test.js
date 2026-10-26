// Walks the whole launcher in Russian (pages, dialogs, toasts, progress) and checks nothing is left in English.
const fs = require('fs');
const path = require('path');
const h = require('./harness');

const mk = (id, title, extra = {}) => ({ id, slug: id, title, type: 'mod', file: `${id}.jar`, versionNumber: '1.0', enabled: true, needs: [], ...extra });

h.run('Russian interface', async ({ js, wait, check, core }) => {
  const { instances: I } = core;
  const inst = I.list()[0];
  check('the language setting "ru" is applied at start-up', (await js('I18N.lang')) === 'ru');
  check('the page language attribute is set', (await js('document.documentElement.lang')) === 'ru');
  check('static markup is translated too (window button tooltips)', (await js("document.querySelector('[data-win=close]').title")) === 'Закрыть');

  const closeOverlays = () => js("document.querySelectorAll('.modal-wrap,.lightbox').forEach(m=>m.remove());0");
  await js(`S.updates={instId:'${inst.id}',list:[{id:'zoom',title:'Zoomify',from:'1.0',to:'1.1',type:'mod'}]};0`);
  for (const v of ['home', 'instances', 'modules', 'hud', 'skin', 'browse', 'modpacks', 'content', 'servers', 'screenshots', 'console', 'settings']) {
    await js(`nav('${v}')`);
    await wait(['modules', 'browse', 'modpacks', 'home'].includes(v) ? 5000 : 2000);
    if (v === 'content') {
      for (const t of ['resourcepack', 'shader']) { await js(`S.contentTab='${t}';render()`); await wait(1200); }
      await js("S.contentTab='mod';render()"); await wait(800);
      await js("(()=>{const i=document.querySelector('#content-q');i.value='nomatch';i.dispatchEvent(new Event('input'))})()"); await wait(400);
      await js("(()=>{const i=document.querySelector('#content-q');i.value='';i.dispatchEvent(new Event('input'))})()");
    }
    if (v === 'browse') for (const t of ['resourcepack', 'shader']) { await js(`S.browse.type='${t}';render()`); await wait(2500); }
    if (v === 'modules') { await js("S.moduleCat='Performance';render()"); await wait(500); await js("S.moduleCat='All';S.moduleQuery='zzzz';render()"); await wait(400); await js("S.moduleQuery='';render()"); }
    if (v === 'console') { await js("S.logs=[];render()"); await wait(300); await js("S.logFilter='zzz';S.logs=[['x','out']];render()"); await wait(300); await js("S.logFilter='';render()"); }
  }

  await js("nav('instances')"); await wait(600);
  const dialogs = [
    'instanceModal()', 'instanceModal(S.instances[0])', "document.querySelector('[data-act=duplicate-instance]').click()", 'pickInstance()', 'welcome()',
    "doctorBefore('x', undefined, { missingFiles: [{ id: 'a', title: 'Zoomify', file: 'zoom.jar' }], missingDeps: [{ id: 'b', title: 'YACL', needBy: ['Zoomify', 'Sodium'] }] })",
    `doctorAfter({ instId: '${inst.id}', ids: [], details: ["Mod 'Zoomify' requires yacl"], other: ['Replace mod x'] })`,
    `oomModal({ instId: '${inst.id}', kind: 'oom', ram: 2048, systemRam: 16384 })`, `oomModal({ instId: '${inst.id}', kind: 'oom', ram: 3072, systemRam: 4096 })`,
    "crashModal({ instId: 'x', file: 'C:/x/crash-reports/c.txt', name: 'c.txt', description: '' })",
    "migrateConfirm(S.instances[0], { version: '26.2', ok: [{ title: 'Sodium' }, { title: 'Lithium' }], missing: [{ title: 'ModernFix' }], hud: 'remove' })",
    "migrateConfirm(S.instances[0], { version: '26.2', ok: [], missing: [], hud: 'keep' })",
    "confirmBox('Delete Alpha?', 'Worlds, mods and screenshots in this instance will be removed permanently.')", "confirmBox('Remove file?', 'x.jar', 'Remove')",
    "confirmBox('Shaders need Iris', 'Iris is the mod that loads shader packs. Install it now?', 'Install Iris')", "confirmBox('Reset Lumen HUD?', 'Positions, sizes and colours go back to defaults.', 'Reset')",
    "lightbox('C:/x/screenshots/a.png')",
  ];
  for (const d of dialogs) { await js(`${d};0`); await wait(450); await closeOverlays(); }

  const toasts = [
    'Created Alpha', 'Installed Zoomify (Zoom), Fabric API', 'Installed Foo (26.3 Fabric)', 'Imported Foo (26.3)', 'Zoomify enabled (+3 dependencies)', 'Zoomify enabled',
    'Sodium disabled (+1 unused dependency removed)', 'Sodium disabled', 'Also removed 2 unused dependencies', 'Essentials installed, skipped: Zoom, Sodium', 'Lumen essentials enabled',
    'Essentials already enabled', 'Fabric does not support 1.8.9', 'Switched to Fabric', 'Instance deleted', 'Logs copied', 'Screenshot copied', 'Moved to the Recycle Bin',
    'Updates installed', 'Everything is up to date', '3 updates available', 'Moved to 26.3 · 5 updated · 1 switched off (no 26.3 build): ModernFix', 'Moved to 26.3 · 5 updated',
    'Fancy.zip is now active in Alpha', 'Fancy.zip switched off', 'Freed 12 MB', 'Nothing to clean up', 'No errors have been logged yet', 'Exported 6 mods and 2 bundled files', 'Exported 6 mods',
    'Added a.jar, b.jar to Alpha', "fab.jar isn't a Fabric mod (it looks like a Forge/NeoForge mod, which can't run here)", "x.zip isn't a resource pack or shader pack (no pack.mcmeta or shaders folder)",
    'n.txt has an unsupported type (.txt); use .jar, .zip or .mrpack', 'b.jar is not a valid .jar/.zip archive', 'v.jar is a mod, but this instance is vanilla. Switch it to Fabric first',
    'Create an instance first, then drop the files again', 'Something went wrong: boom. Details are in launcher.log (Settings → Storage).', 'Mods are still installing — wait for the task in the corner to finish',
    'A game is already running', 'Could not fix: Could not download a.jar: Checksum mismatch for a.jar', 'Game exited with code 1 — check the Console', 'Search failed: HTTP 500 for https://x',
    'Zoomify (Zoom) is required by Sodium. Remove those first.', 'Add an account in Settings first', 'Close the game first', 'Nickname must be 3–16 letters, digits or _',
    "This pack needs NeoForge, which Lumen can't launch yet. Only Fabric and vanilla packs work.", 'Unsafe path in modpack: ../x', 'Unknown Minecraft version 9.9.9',
    'Required dependency YACL has no build for 26.3', 'Zoomify is not available for 26.3', 'Not a Modrinth modpack (modrinth.index.json is missing)',
  ];
  for (const m of toasts) await js(`toast(${JSON.stringify(m)}, 'ok');0`);
  await js("S.tasks=[{id:1,label:'Installing',status:'Installing Zoomify'},{id:2,label:'Moving to 26.3',status:'Updating Sodium'},{id:3,label:'Enabling Zoomify',status:''},{id:4,label:'Importing modpack',status:'Downloading 3/9 files'},{id:5,label:'Installing Lumen essentials',status:'Sodium (2/9)'},{id:6,label:'Checking for updates',status:''},{id:7,label:'Duplicating instance',status:''}];S.game={state:'preparing',instId:'x'};S.view='home';render();0");
  await wait(500);
  for (const p of ['Preparing…', 'Fetching Minecraft 26.3', 'Fetching Fabric 0.20.1', 'Downloading Java (java-runtime-epsilon)', 'Downloading libraries', 'Downloading assets', 'Starting Minecraft…']) { await js(`S.progress={text:${JSON.stringify(p)},done:3,total:9};paintProgress();0`); await wait(120); }
  await js("S.tasks=[];S.game={state:'idle'};render();0");
  await js("document.dispatchEvent(new DragEvent('dragenter',{dataTransfer:(()=>{const d=new DataTransfer();d.items.add(new File(['x'],'a.jar'));return d})(),cancelable:true,bubbles:true}));0"); await wait(400);
  await js('showDrop(false);0'); await wait(600);

  // What is allowed to stay in English: names of mods, files and versions (they are not interface text).
  const names = new Set(require(path.join(h.root, 'core', 'modules')).map((m) => m.name).concat(['Lumen HUD', 'Zoomify', 'Sodium', 'Lithium', 'YACL', 'Fabric API', 'x.jar']));
  const missing = (await js('I18N.missing()')).filter((s) => !names.has(s) && !/\.(jar|zip)|\(\d+\/\d+\)|^Sodium, |^-XX/.test(s));
  check('nothing is left in English', missing.length === 0, JSON.stringify(missing));

  // English stays English: translation must be off when the language is English.
  const en = await js("(() => { const t = I18N.t('Home'); return t })()");
  check('I18N.t translates on demand', en === 'Главная');
}, {
  setup({ store, instances }) {
    store.addOfflineAccount('Tester');
    store.update({ settings: { language: 'ru' } });
    const inst = instances.create({ name: 'Alpha', version: '26.3', loader: 'fabric' });
    return instances.patch(inst.id, (i) => {
      i.playtime = 4000; i.lastPlayed = Date.now() - 5 * 60e3;
      for (const e of [mk('fabric', 'Fabric API', { dependency: true }), mk('zoom', 'Zoomify', { needs: ['fabric'], module: 'zoomify' }), mk('old', 'OldMod', { incompatible: '26.3', enabled: false })]) i.content[e.id] = e;
      i.content.pack = mk('pack', 'FancyPack', { type: 'resourcepack' });
    }).then(() => {
      for (const f of ['fabric.jar', 'zoom.jar', 'old.jar.disabled', 'handmade.jar']) {
        fs.mkdirSync(path.join(instances.dirOf(inst.id), 'mods'), { recursive: true });
        fs.writeFileSync(path.join(instances.dirOf(inst.id), 'mods', f), 'x');
      }
      store.update({ selectedInstance: inst.id });
    });
  },
});
