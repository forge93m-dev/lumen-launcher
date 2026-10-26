const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const I18N = require('../../renderer/i18n');
const ru = require('../../renderer/lang/ru');

const tr = I18N.createTranslator(ru);

test('plural: Russian forms (1 мод, 2 мода, 5 модов, 11 модов, 21 мод)', () => {
  const f = (n) => I18N.plural(n, 'мод', 'мода', 'модов');
  assert.deepEqual([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 100, 101, 111].map(f),
    ['модов', 'мод', 'мода', 'мода', 'модов', 'модов', 'модов', 'модов', 'мод', 'мода', 'модов', 'модов', 'мод', 'модов']);
});

test('resolve: auto follows the system language, explicit choices win', () => {
  assert.equal(I18N.resolve('auto', 'ru'), 'ru');
  assert.equal(I18N.resolve('auto', 'ru-RU'), 'ru');
  assert.equal(I18N.resolve('auto', 'uk'), 'ru');
  assert.equal(I18N.resolve('auto', 'en-US'), 'en');
  assert.equal(I18N.resolve(undefined, 'de'), 'en');
  assert.equal(I18N.resolve('en', 'ru'), 'en');
  assert.equal(I18N.resolve('ru', 'en-US'), 'ru');
});

test('translator: exact phrases keep their surrounding whitespace; unknown text is left alone', () => {
  assert.equal(tr('Home'), 'Главная');
  assert.equal(tr('  Play\n  '), '  Играть\n  ');
  assert.equal(tr('Sodium'), null);
  assert.equal(tr('   '), null);
  assert.equal(tr(''), null);
  assert.equal(tr('constructor'), null, 'inherited object keys must not count as translations');
});

test('translator: patterns fill in numbers and names, with correct plural forms', () => {
  assert.equal(tr('3 mods'), '3 мода');
  assert.equal(tr('5 mods'), '5 модов');
  assert.equal(tr('21 mods'), '21 мод');
  assert.equal(tr('Last played 5m ago'), 'Последний запуск: 5 мин назад');
  assert.equal(tr('Last played never'), 'Последний запуск: никогда');
  assert.equal(tr('1h 6m'), '1 ч 6 мин');
  assert.equal(tr('Good evening, Steve'), 'Добрый вечер, Steve');
  assert.equal(tr('Created My World'), 'Создана сборка «My World»');
  assert.equal(tr('Delete My World?'), 'Удалить «My World»?');
  assert.equal(tr('Update all (4)'), 'Обновить всё (4)');
});

test('translator: names that look like phrases are not mistaken for them', () => {
  assert.equal(tr('Installed Zoomify (Zoom), Fabric API'), 'Установлено: Zoomify (Zoom), Fabric API');
  assert.equal(tr('Installed Foo (26.3 Fabric)'), 'Установлена сборка «Foo» (26.3 Fabric)');
});

test('translator: a pattern can translate the error text it contains', () => {
  assert.equal(tr('Could not fix: Could not download a.jar: Checksum mismatch for a.jar'),
    'Не удалось исправить: Не удалось скачать a.jar: Контрольная сумма не совпала: a.jar');
  assert.match(tr('Fabric API is required by Zoomify. Remove those first.'), /нужен для: Zoomify\. Сначала удалите их\.$/);
});

test('translator: sizes, storage and the "unused" sentence', () => {
  assert.equal(tr('Free 12 MB'), 'Освободить 12 МБ');
  assert.equal(tr('4.0 GB'), '4.0 ГБ');
  assert.equal(tr('2 unused versions (1.8.9, 1.20.4) and 1 unused Java runtime. They are downloaded again if you ever need them.'),
    '2 неиспользуемые версии (1.8.9, 1.20.4) и 1 неиспользуемая среда Java. Они скачаются снова, если понадобятся.');
  assert.equal(tr('1 unused version (1.8.9). They are downloaded again if you ever need them.'), '1 неиспользуемая версия (1.8.9). Они скачаются снова, если понадобятся.');
});

test('translator: long dialogs with optional parts', () => {
  const full = tr('It was given 4 GB and needed more, which is common with this many mods. Your computer only has 6 GB in total, so there is no safe way to give it more. Removing some mods will help.');
  assert.match(full, /^Игре выделено 4 ГБ, и этого не хватило \(с таким числом модов это обычное дело\)\. Всего в компьютере 6 ГБ/);
  assert.equal(tr('It was given 2 GB and needed more.'), 'Игре выделено 2 ГБ, и этого не хватило.');
});

test('pack: every pattern is anchored and every entry has a non-empty translation', () => {
  for (const [re, rep] of ru.patterns) {
    assert.ok(re.source.startsWith('^') && re.source.endsWith('$'), `unanchored pattern: ${re}`);
    assert.ok(typeof rep === 'function' || typeof rep === 'string');
  }
  for (const [k, v] of Object.entries(ru.dict)) assert.ok(typeof v === 'string' && v.trim(), `empty translation for "${k}"`);
});

test('pack: no translation contains a leftover template placeholder', () => {
  for (const [k, v] of Object.entries(ru.dict)) assert.ok(!/\$\{|\$\d/.test(v), `template leftover in "${k}"`);
});

// ---------- completeness: new English text must not ship without a translation ----------

test('every module description has a Russian translation', () => {
  const modules = require('../../core/modules');
  const missing = modules.filter((m) => tr(m.desc) === null).map((m) => m.name);
  assert.deepEqual(missing, []);
});

test('every fixed English string written into renderer/app.js has a Russian translation', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const found = new Map();
  const add = (kind, s, idx) => {
    s = s.trim();
    if (!/[A-Za-z]{2}/.test(s)) return;
    if (/ \? | : |^'| ' ?:/.test(s)) return; // a piece of JavaScript between two template parts, not text
    if (!found.has(s)) found.set(s, `${kind} (line ${src.slice(0, idx).split('\n').length})`);
  };
  let m;
  const text = />([^<>`$\n{}]*[A-Za-z][^<>`$\n{}]*)</g; // text between tags
  while ((m = text.exec(src))) { if (!/[=-]$/.test(src.slice(Math.max(0, m.index - 1), m.index))) add('text', m[1], m.index); }
  const after = /\}([A-Z][^<>`$\n{}]*?)(?=<|`)/g; // text right after an interpolation
  while ((m = after.exec(src))) add('text', m[1], m.index);
  for (const attr of ['placeholder', 'title']) {
    const re = new RegExp(`${attr}="([^"$]*[A-Za-z][^"$]*)"`, 'g');
    while ((m = re.exec(src))) add(attr, m[1], m.index);
  }
  const calls = /\b(toast|confirmBox)\(\s*(['"`])((?:(?!\2)[^\\\n]|\\.)*)\2/g;
  while ((m = calls.exec(src))) { if (!/\$\{/.test(m[3])) add(m[1], m[3], m.index); }
  const missing = [...found].filter(([s]) => tr(s) === null).map(([s, where]) => `${where}: "${s}"`);
  assert.deepEqual(missing, [], 'add these to renderer/lang/ru.js');
});
