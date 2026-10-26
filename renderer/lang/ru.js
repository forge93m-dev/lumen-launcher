// Russian language pack. Left side: the English text exactly as the launcher shows it. Right side: the translation.
// `dict` is for fixed phrases; `patterns` is for text with numbers and names in it (first match wins).
(function (root) {
  'use strict';
  const plural = (root.I18N && root.I18N.plural) || ((n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; });

  // Filled in by the engine so patterns can translate the pieces they contain (a time, a version, an error text...).
  let translate = () => null;
  const sub = (s) => { const t = translate(s); return t === null ? s : t; };
  const n = (num, one, few, many) => `${num} ${plural(+num, one, few, many)}`;
  const gb = (s) => s.replace(/\bGB\b/g, 'ГБ').replace(/\bMB\b/g, 'МБ').replace(/\bKB\b/g, 'КБ');
  const time = (s) => s.replace(/(\d+)h (\d+)m/, '$1 ч $2 мин').replace(/^(\d+)m$/, '$1 мин').replace(/(\d+)m\b/, '$1 мин');
  const loader = (s) => (s === 'Fabric' || s === 'Vanilla' ? s : sub(s));
  const dropKind = { 'use client modules': 'пользоваться модулями клиента', 'browse and install content': 'смотреть и устанавливать контент', 'manage content': 'управлять контентом', 'see screenshots': 'смотреть скриншоты', 'use Lumen HUD': 'пользоваться Lumen HUD' };
  const kinds = { mods: 'моды', 'resource packs': 'ресурспаки', shaders: 'шейдеры' };
  const greetings = { 'Good night': 'Доброй ночи', 'Good morning': 'Доброе утро', 'Good afternoon': 'Добрый день', 'Good evening': 'Добрый вечер' };

  const dict = {
    // ----- navigation, account
    Home: 'Главная', Instances: 'Сборки', 'Client Modules': 'Модули клиента', 'HUD Editor': 'Редактор HUD', Browse: 'Каталог',
    Modpacks: 'Модпаки', Installed: 'Установлено', Servers: 'Серверы', Screenshots: 'Скриншоты', Console: 'Консоль', Settings: 'Настройки',
    LIVE: 'В ИГРЕ', 'Updates available': 'Есть обновления', 'No account': 'Нет аккаунта', 'Click to add': 'Нажмите, чтобы добавить',
    'Offline account': 'Оффлайн-аккаунт', Minimize: 'Свернуть', Maximize: 'Развернуть', Close: 'Закрыть',

    // ----- common buttons and words
    Cancel: 'Отмена', Save: 'Сохранить', Create: 'Создать', Add: 'Добавить', Play: 'Играть', Select: 'Выбрать', Use: 'Включить', Active: 'Активно',
    Install: 'Установить', Delete: 'Удалить', Remove: 'Удалить', Reset: 'Сбросить', Refresh: 'Обновить', Clear: 'Очистить', Copy: 'Копировать',
    Folder: 'Папка', Join: 'Зайти', Edit: 'Изменить', Duplicate: 'Дублировать', Enable: 'Включить', Disable: 'Выключить', All: 'Все', Name: 'Название',
    Height: 'Высота', Colour: 'Цвет', Loader: 'Загрузчик', Total: 'Всего', Fabric: 'Fabric', Vanilla: 'Vanilla', Offline: 'Не в сети',
    'Pinging…': 'Проверяю…', never: 'никогда', 'just now': 'только что', Language: 'Язык', English: 'English', FPS: 'FPS', CPS: 'CPS', 'launcher.log': 'launcher.log', 'RAM override (MB)': 'Своя память (МБ)', 'Auto (as in system)': 'Авто (как в системе)',

    // ----- home
    CREATE: 'СОЗДАТЬ', STOP: 'СТОП', PLAY: 'ИГРАТЬ', LAUNCHING: 'ЗАПУСК', 'Welcome to Lumen': 'Добро пожаловать в Lumen',
    'Create an instance, toggle modules and jump in.': 'Создайте сборку, включите модули и заходите в игру.',
    'Active modules': 'Активные модули', 'Total playtime': 'Всего в игре', 'This instance': 'Эта сборка', 'Quick join': 'Быстрый вход',
    'All servers': 'Все серверы', 'No servers saved.': 'Нет сохранённых серверов.', 'Minecraft news': 'Новости Minecraft',
    'News unavailable offline.': 'Новости недоступны без интернета.', 'Preparing…': 'Подготовка…', 'Starting Minecraft…': 'Запуск Minecraft…',
    'No instance yet': 'Сборок пока нет', 'New instance': 'Новая сборка',

    // ----- instances
    'Separate game folders, each with its own version, modules and worlds.': 'Отдельные папки игры: у каждой своя версия, модули и миры.',
    'Import .mrpack': 'Импорт .mrpack', '● Running': '● Запущена', 'Open folder': 'Открыть папку', 'Export as .mrpack': 'Экспорт в .mrpack',
    'Delete instance': 'Удалить сборку', 'Worlds, mods and screenshots in this instance will be removed permanently.': 'Миры, моды и скриншоты этой сборки будут удалены навсегда.',
    'Instance deleted': 'Сборка удалена',

    // ----- modules
    'Could not load modules': 'Не удалось загрузить модули', 'Enable essentials': 'Включить базовый набор', 'Modules run on Fabric.': 'Модули работают на Fabric.',
    'This instance is vanilla. Switch it to Fabric to enable modules — your worlds stay untouched.': 'Эта сборка чистая (vanilla). Переключите её на Fabric, чтобы включать модули: ваши миры не пострадают.',
    'Switch to Fabric': 'Перейти на Fabric', 'Switched to Fabric': 'Переключено на Fabric', 'Filter modules': 'Поиск по модулям',
    Performance: 'Производительность', Visual: 'Графика', HUD: 'HUD', Utility: 'Утилиты', Audio: 'Звук', Lumen: 'Lumen', Essential: 'Базовый',
    'No modules match.': 'Подходящих модулей нет.', 'Open HUD Editor': 'Открыть редактор HUD', 'Essentials already enabled': 'Базовый набор уже включён',
    'Lumen essentials enabled': 'Базовый набор Lumen включён',
    'Rewritten renderer. Often doubles or triples your FPS.': 'Переписанный движок отрисовки. Часто увеличивает FPS в два-три раза.',
    'Optimizes game logic, physics and AI without changing behaviour.': 'Оптимизирует логику игры, физику и ИИ, не меняя поведения.',
    'Cuts RAM usage dramatically.': 'Заметно снижает потребление памяти.',
    'Skips rendering entities and block entities you cannot see.': 'Не рисует существ и блоки-сущности, которые вы не видите.',
    'Faster HUD, text and entity rendering.': 'Быстрее рисует интерфейс, текст и существ.',
    'Faster startup and world loading, lower memory.': 'Быстрее запуск и загрузка мира, меньше памяти.',
    'Lowers FPS when the game is in the background to save power.': 'Снижает FPS, когда игра в фоне, чтобы экономить энергию.',
    'Extra culling for leaves, item frames and more.': 'Дополнительная отсечка для листвы, рамок и не только.',
    'Load shader packs. Browse shaders in the Browse tab.': 'Загрузка шейдеров. Искать шейдеры можно во вкладке «Каталог».',
    'Smooth, configurable zoom key (C by default).': 'Плавный настраиваемый зум (по умолчанию клавиша C).',
    'Renders the outer skin layer in 3D.': 'Рисует внешний слой скина объёмным.',
    'Seamless glass and connected textures for resource packs.': 'Бесшовное стекло и связные текстуры для ресурспаков.',
    'Torches in hand light up the area around you.': 'Факел в руке освещает всё вокруг вас.',
    'Third-person animations for eating, maps, ladders and more.': 'Анимации от третьего лица: еда, карты, лестницы и другое.',
    'Capes flow with physics instead of a flat plane.': 'Плащи развеваются по законам физики, а не висят плоско.',
    'Hollow leaf blocks for clean visuals and more FPS.': 'Полая листва: чище картинка и больше FPS.',
    'A clean, colored and customizable debug screen.': 'Аккуратный цветной экран отладки с настройками.',
    'Shows food saturation and hunger restored on the HUD.': 'Показывает на HUD насыщение и сколько голода восстановит еда.',
    "Xaero's minimap with waypoints.": 'Миникарта Xaero с метками.', 'Full-screen explored world map.': 'Карта изученного мира на весь экран.',
    'Tooltip with info about the block or mob you look at.': 'Подсказка о блоке или мобе, на который вы смотрите.',
    "Shows a player's head next to their chat messages.": 'Показывает голову игрока рядом с его сообщениями в чате.',
    'In-game list of modules with settings buttons.': 'Список модулей в игре с кнопками настроек.',
    'Faster inventory management with drag and scroll.': 'Быстрее работа с инвентарём: перетаскивание и колесо мыши.',
    'See shulker box contents in the tooltip.': 'Содержимое шалкера видно в подсказке.',
    'Strips chat signatures for privacy.': 'Убирает подписи чата ради приватности.',
    'Fullscreen that alt-tabs instantly.': 'Полный экран, из которого мгновенно переключаешься по Alt+Tab.',
    'Return to title instantly while the world saves in the background.': 'Мгновенный выход в меню: мир сохраняется в фоне.',
    'Realistic reverb, occlusion and echo.': 'Реалистичные реверберация, заглушение и эхо.',
    'Detailed footstep sounds for every surface.': 'Подробные звуки шагов для каждой поверхности.',
    'Our own HUD: FPS, CPS, ping, keystrokes, coordinates, armor, potion effects and more. Edit it in the HUD Editor.': 'Наш собственный HUD: FPS, CPS, пинг, клавиши, координаты, броня, эффекты зелий и не только. Настраивается в редакторе HUD.',

    // ----- browse, modpacks, project
    Mods: 'Моды', 'Resource Packs': 'Ресурспаки', Shaders: 'Шейдеры', Relevance: 'По релевантности', 'Most downloaded': 'Самые скачиваемые',
    'Most followed': 'По числу подписчиков', Newest: 'Новые', 'Recently updated': 'Недавно обновлённые', 'Mods need Fabric.': 'Для модов нужен Fabric.',
    'Switch this instance to Fabric to install mods.': 'Переключите эту сборку на Fabric, чтобы устанавливать моды.', 'Shaders need Iris.': 'Для шейдеров нужен Iris.',
    'Enable the Shaders module so packs show up in-game (Video Settings → Shader Packs).': 'Включите модуль «Шейдеры», чтобы паки появились в игре (Настройки видео → Шейдерпаки).',
    'Enable Iris': 'Включить Iris', 'Install Iris': 'Установить Iris', 'Nothing found': 'Ничего не найдено', 'Try another search or a different version.': 'Попробуйте другой запрос или другую версию.',
    'Modrinth page': 'Страница на Modrinth', 'Install as new instance': 'Установить как новую сборку',
    'Ready-made Fabric packs from Modrinth. Every pack installs as its own instance, so your other worlds stay untouched.': 'Готовые сборки Fabric с Modrinth. Каждый модпак ставится как отдельная сборка, поэтому ваши миры не пострадают.',
    'Search modpacks…': 'Поиск модпаков…', 'No modpacks found': 'Модпаки не найдены', 'Try another search.': 'Попробуйте другой запрос.',

    // ----- installed
    'Check updates': 'Проверить обновления', 'Up to date': 'Всё актуально', Module: 'Модуль', Dependency: 'Зависимость', 'Local file': 'Свой файл',
    'Added manually': 'Добавлен вручную', 'Nothing matches': 'Ничего не найдено',
    'Iris is the mod that loads shader packs. Install it and use the buttons below to pick one.': 'Iris — мод, который загружает шейдеры. Установите его и выберите шейдер кнопками ниже.',
    'Click to switch off': 'Нажмите, чтобы выключить', 'Switch on in the game': 'Включить в игре', 'Find some in Browse or enable Client Modules.': 'Найдите их в каталоге или включите модули клиента.',
    'Find some in Browse.': 'Найдите их в каталоге.', 'Try a different search.': 'Попробуйте другой запрос.',

    // ----- servers
    'No servers': 'Серверов нет', 'Add your favourite servers above.': 'Добавьте любимые серверы выше.', 'Address, e.g. play.example.net:25565': 'Адрес, например play.example.net:25565',

    // ----- screenshots, console
    'No screenshots yet': 'Скриншотов пока нет', 'Press F2 while playing.': 'Нажмите F2 во время игры.', 'Show in folder': 'Показать в папке',
    'Screenshot copied': 'Скриншот скопирован', 'Moved to the Recycle Bin': 'Перемещено в корзину', 'Live game output appears here.': 'Здесь появляется вывод игры.',
    '● Game running': '● Игра запущена', 'Filter log': 'Фильтр лога', 'Logs folder': 'Папка логов', 'Kill game': 'Закрыть игру', 'Logs copied': 'Логи скопированы',
    'No lines match the filter.': 'Нет строк, подходящих под фильтр.', 'No output yet. Launch the game to see logs.': 'Вывода пока нет. Запустите игру, чтобы увидеть логи.',

    // ----- settings
    'Accounts, performance and launcher behaviour.': 'Аккаунты, производительность и поведение лаунчера.', Accounts: 'Аккаунты',
    'Offline accounts work in singleplayer and on servers with online-mode off.': 'Оффлайн-аккаунты работают в одиночной игре и на серверах с выключенным online-mode.',
    'Microsoft sign-in requires a registered Azure application and is planned for a future release.': 'Для входа через Microsoft нужно зарегистрированное приложение Azure; он появится в одной из следующих версий.',
    Nickname: 'Ник', 'Memory & Java': 'Память и Java', 'Defaults for every instance. Instances can override RAM.': 'Значения по умолчанию для всех сборок. У сборки можно задать свою память.',
    'Allocated RAM': 'Выделенная память', 'Window width': 'Ширина окна', 'Extra JVM arguments': 'Дополнительные аргументы JVM', 'Custom Java path': 'Свой путь к Java',
    '— empty uses the bundled runtime': '— пусто = встроенная Java', Automatic: 'Автоматически', Launcher: 'Лаунчер', 'Appearance and behaviour.': 'Внешний вид и поведение.',
    'Hide launcher while playing': 'Скрывать лаунчер во время игры', 'Comes back when the game closes.': 'Вернётся, когда игра закроется.',
    'Start in fullscreen': 'Запускать в полноэкранном режиме', 'Minecraft opens fullscreen instead of in a window.': 'Minecraft откроется на весь экран, а не в окне.',
    'Show snapshots': 'Показывать снапшоты', 'Include snapshot versions when creating instances.': 'Добавляет снапшоты в список версий при создании сборки.',
    'Accent colour': 'Цвет акцента', Storage: 'Хранилище', 'Game files are shared between instances to save space.': 'Файлы игры общие для всех сборок, чтобы экономить место.',
    'Measuring…': 'Подсчёт…', 'Open data folder': 'Открыть папку данных', 'Instances (worlds, mods, screenshots)': 'Сборки (миры, моды, скриншоты)',
    'Game assets (sounds, languages)': 'Ресурсы игры (звуки, языки)', Libraries: 'Библиотеки', 'Java runtimes': 'Среды Java', 'Minecraft versions': 'Версии Minecraft',
    'Nothing unused to clean up.': 'Ненужных файлов нет.', 'Nothing to clean up': 'Убирать нечего', 'No errors have been logged yet': 'Ошибок в журнале пока нет',

    // ----- HUD editor
    'Lumen HUD is our own Fabric mod. Edits save instantly and apply live, even mid-game.': 'Lumen HUD — наш собственный мод для Fabric. Изменения сохраняются сразу и применяются в игре на лету.',
    'Right Shift in-game opens the editor too': 'Right Shift в игре тоже открывает редактор', 'Saved · applies live in-game': 'Сохранено · применяется в игре сразу',
    Elements: 'Элементы', 'Drag in the preview · scroll to resize · right-click to hide.': 'Перетаскивайте в превью · колесо меняет размер · правая кнопка скрывает.',
    Ping: 'Пинг', Speed: 'Скорость', Clock: 'Часы', Coordinates: 'Координаты', Keystrokes: 'Клавиши', Armor: 'Броня', 'Potion effects': 'Эффекты зелий', Reach: 'Дальность удара', Combo: 'Комбо',
    Memory: 'Память', 'Session time': 'Время сессии', 'Item counter': 'Счётчик предметов', 'Target info': 'Информация о цели', 'Server address': 'Адрес сервера', 'Sprint status': 'Статус спринта',
    'Show maximum': 'Показывать максимум', Totems: 'Тотемы', 'Golden apples': 'Золотые яблоки', 'Ender pearls': 'Жемчуг Эндера', 'End crystals': 'Кристаллы Энда',
    'Menu look': 'Вид меню', 'The in-game menu (Right Shift): its colours and what is behind it.': 'Меню в игре (Right Shift): его цвета и то, что за ним.',
    Skin: 'Скин', Backdrop: 'Фон', Dim: 'Затемнение', Gradient: 'Градиент', Picture: 'Картинка', 'Backdrop dimming': 'Затемнение фона',
    'No picture chosen yet.': 'Картинка ещё не выбрана.', 'Choose picture': 'Выбрать картинку', Remove: 'Убрать',
    midnight: 'Полночь', graphite: 'Графит', ocean: 'Океан', rose: 'Роза', forest: 'Лес', light: 'Светлая',
    Skin: 'Скин', 'The skin your own player wears in Lumen HUD instances. Only you see it: other players keep seeing your normal skin.': 'Скин, в котором вы ходите в сборках с Lumen HUD. Его видите только вы: другие игроки видят ваш обычный скин.',
    'The default skin': 'Скин по умолчанию', 'No custom skin': 'Свой скин не выбран', 'Add a skin to the right to try it out.': 'Добавьте скин справа, чтобы попробовать.',
    Classic: 'Обычный', Slim: 'Тонкие руки', 'Slim has thinner arms (Alex). Pick the one your skin was made for.': 'У «Тонкие руки» руки тоньше (Алекс). Выберите тот вариант, для которого сделан скин.',
    'Use the default skin': 'Вернуть скин по умолчанию', 'Add a skin': 'Добавить скин', 'A 64×64 (or old 64×32) PNG file, or the skin of any Minecraft player.': 'PNG-файл 64×64 (или старый 64×32) либо скин любого игрока Minecraft.',
    'Choose a PNG file': 'Выбрать PNG-файл', "Take a player's skin by nickname": 'Взять скин игрока по нику', 'Get skin': 'Получить скин',
    'Your skins': 'Ваши скины', 'Nothing yet.': 'Пока ничего.', 'Skin added': 'Скин добавлен', 'Type a nickname first': 'Сначала введите ник',
    'Remove this skin?': 'Удалить этот скин?', 'It is deleted from the launcher. The picture you imported it from is not touched.': 'Он удалится из лаунчера. Файл, из которого вы его импортировали, не тронется.',
    Cape: 'Плащ', 'A 64×32 (or 22×17) PNG. It hangs on your back in Lumen HUD instances.': 'PNG 64×32 (или 22×17). Он висит у вас за спиной в сборках с Lumen HUD.',
    'Choose a cape': 'Выбрать плащ', 'Remove the cape': 'Убрать плащ', 'No cape yet.': 'Плаща пока нет.',
    'Skins and capes of Lumen players are shared automatically, nothing to set up.': 'Скины и плащи игроков Lumen передаются автоматически, ничего настраивать не нужно.',
    'This build has no skin service of its own. Enter the address of one below to share skins and capes.': 'В этой сборке нет своего сервиса скинов. Введите ниже адрес сервиса, чтобы делиться скинами и плащами.',
    'Built-in service (change only to use your own)': 'Встроенный сервис (меняйте, только если хотите свой)', 'Using your own service.': 'Используется ваш сервис.', 'Using the built-in service.': 'Используется встроенный сервис.', 'Not connected.': 'Нет подключения.',
    'Lumen skin service': 'Сервис скинов Lumen', "Lets Lumen players see each other's skins and capes. Without an address, only you see yours.": 'Позволяет игрокам Lumen видеть скины и плащи друг друга. Без адреса свой скин видите только вы.',
    Check: 'Проверить', "See other players' skins and capes": 'Видеть скины и плащи других игроков', 'The game asks the service for the players around you.': 'Игра спрашивает у сервиса про игроков рядом с вами.',
    'Uploaded as': 'Загружается как', 'Share my skin and cape': 'Делиться своим скином и плащом', 'Add an account first.': 'Сначала добавьте аккаунт.',
    'Saved. Press Check to test the connection.': 'Сохранено. Нажмите «Проверить», чтобы проверить соединение.', 'The service is off.': 'Сервис выключен.', 'Checking…': 'Проверяю…',
    'https://skins.example.com': 'https://skins.example.com',
    Compass: 'Компас', Preset: 'Пресет', Default: 'По умолчанию', PvP: 'PvP', Survival: 'Выживание', Clean: 'Чистый', 'Last death': 'Место смерти', 'Durability alert': 'Предупреждение о прочности', 'Say it in chat after respawn': 'Написать в чат после возрождения', 'Warn below': 'Предупреждать ниже',
    'Toggle sneak': 'Переключаемый присед', 'Press the sneak key once to sneak, again to stop': 'Нажмите присед один раз, чтобы красться, ещё раз — чтобы остановиться',
    Freelook: 'Свободный обзор', 'Hold Left Alt to look around without turning': 'Зажмите левый Alt, чтобы осматриваться, не поворачивая персонажа',
    'Smooth zoom': 'Плавный зум', Theme: 'Тема', Glass: 'Стекло', Flat: 'Плоская', Minimal: 'Минимализм',
    'Client features': 'Функции клиента', 'Work in-game, no extra mods needed.': 'Работают в игре, дополнительные моды не нужны.',
    'Toggle sprint': 'Авто-спринт', 'Keeps you sprinting while you hold W': 'Вы бежите, пока зажата W', Fullbright: 'Полная яркость', 'Dark caves and nights are fully lit': 'Тёмные пещеры и ночь полностью освещены',
    Zoom: 'Зум', 'Hold C in-game to zoom in': 'Зажмите C в игре, чтобы приблизить', 'Zoom field of view': 'Угол обзора при зуме',
    'Show facing': 'Показывать направление', 'Show biome': 'Показывать биом', 'CPS under mouse buttons': 'CPS под кнопками мыши', 'Space bar': 'Пробел',
    'Durability numbers': 'Цифры прочности', 'Held item': 'Предмет в руке', '24-hour format': '24-часовой формат', Style: 'Стиль',
    'Applies to every element.': 'Применяется ко всем элементам.', 'Text colour': 'Цвет текста', Background: 'Фон', Opacity: 'Непрозрачность',
    'Text shadow': 'Тень текста', 'Hide when F3 is open': 'Скрывать при открытом F3', 'Reset layout & style': 'Сбросить расположение и стиль',
    'Reset Lumen HUD?': 'Сбросить Lumen HUD?', 'Positions, sizes and colours go back to defaults.': 'Позиции, размеры и цвета вернутся к значениям по умолчанию.',
    'Create 26.3 instance': 'Создать сборку 26.3', 'Install Lumen HUD': 'Установить Lumen HUD', 'Installs the mod plus Fabric API. Your layout below is kept.': 'Ставит мод и Fabric API. Ваше расположение ниже сохранится.',
    'Drag to move': 'Тащите, чтобы двигать', 'Scroll to resize': 'Колесо — размер', 'Right-click to hide': 'ПКМ — скрыть', 'Preview: 1280×720, GUI scale 3': 'Превью 1280×720, масштаб 3', '-XX:+UseZGC': '-XX:+UseZGC',

    // ----- instance dialogs
    'Edit instance': 'Изменить сборку', 'Change version, loader or memory.': 'Измените версию, загрузчик или память.',
    'Pick a version — Lumen downloads everything on first launch.': 'Выберите версию: Lumen скачает всё нужное при первом запуске.',
    'My survival world': 'Мой мир выживания', 'Minecraft version': 'Версия Minecraft', 'Recommended for this many mods:': 'Рекомендуется для такого числа модов:',
    'Install Lumen essentials': 'Установить базовый набор Lumen', 'Sodium, Lithium, Zoom, Mod Menu and other performance modules.': 'Sodium, Lithium, Zoom, Mod Menu и другие модули для производительности.',
    'Select instance': 'Выбор сборки', 'Used for Play, modules, browsing and servers.': 'Используется для запуска, модулей, каталога и серверов.',
    'Lumen HUD will be removed': 'Lumen HUD будет удалён', 'Nothing in this instance needs to change.': 'В этой сборке ничего менять не нужно.',
    'Move & update mods': 'Перейти и обновить моды', 'A copy with the same version, mods and settings, to experiment on safely.': 'Копия с той же версией, модами и настройками, чтобы безопасно экспериментировать.',
    'Copy worlds too': 'Копировать и миры', 'Off by default: worlds can be large.': 'По умолчанию выключено: миры могут быть большими.',
    'Remove file?': 'Удалить файл?', 'Shaders need Iris': 'Для шейдеров нужен Iris', 'Iris is the mod that loads shader packs. Install it now?': 'Iris — мод, который загружает шейдеры. Установить его сейчас?',
    'Create an instance first, then drop the files again': 'Сначала создайте сборку, потом перетащите файлы ещё раз',

    // ----- welcome
    'A fast Minecraft client with one-click modules. Pick a nickname to get started.': 'Быстрый клиент Minecraft с модулями в один клик. Выберите ник, чтобы начать.',
    'Create a ready-to-play instance': 'Создать готовую к игре сборку', 'Latest version on Fabric with Lumen essentials.': 'Последняя версия на Fabric с базовым набором Lumen.',
    'Get started': 'Начать',

    // ----- launch doctor
    'Fix before playing?': 'Исправить перед игрой?', 'The game would not start with the mods as they are now.': 'С текущим набором модов игра не запустится.',
    'Play anyway': 'Играть всё равно', 'Fix & play': 'Исправить и играть', 'A mod is missing': 'Не хватает мода',
    'Fabric could not start the game. The game was closed.': 'Fabric не смог запустить игру. Игра закрыта.', 'Install & play again': 'Установить и запустить снова',
    'See the Console for details.': 'Подробности — в консоли.', 'Will switch on:': 'Будет включён:', 'Will download again:': 'Будет скачан заново:', 'Can install:': 'Можно установить:',
    'Not found on Modrinth, install manually:': 'Не найдено на Modrinth, установите вручную:', 'Minecraft ran out of memory': 'Minecraft не хватило памяти',
    'The game crashed': 'Игра вылетела', 'Minecraft stopped unexpectedly.': 'Minecraft неожиданно остановился.', 'Show console': 'Открыть консоль', 'Open crash report': 'Открыть отчёт о вылете',
    'Mods are still installing — wait for the task in the corner to finish': 'Моды ещё устанавливаются: дождитесь окончания задачи в углу',
    'A game is already running': 'Игра уже запущена',

    // ----- drag and drop
    'Drop files to add them': 'Перетащите файлы, чтобы добавить', 'Mods (.jar) · resource packs and shaders (.zip) · modpacks (.mrpack)': 'Моды (.jar) · ресурспаки и шейдеры (.zip) · модпаки (.mrpack)',
    'Drop a modpack (.mrpack) to import it': 'Перетащите модпак (.mrpack), чтобы импортировать его',

    // ----- progress / tasks
    Installing: 'Установка', 'Installing modpack': 'Установка модпака', 'Importing modpack': 'Импорт модпака', 'Exporting modpack': 'Экспорт модпака', 'Fixing mods': 'Исправление модов',
    'Installing missing mods': 'Установка недостающих модов', 'Duplicating instance': 'Дублирование сборки', 'Checking for updates': 'Проверка обновлений', Updating: 'Обновление',
    'Installing Lumen essentials': 'Установка базового набора Lumen', 'Downloading libraries': 'Загрузка библиотек', 'Downloading assets': 'Загрузка ресурсов игры',
    'Applying pack settings': 'Применение настроек модпака', 'Identifying mods': 'Определение модов', 'Updates installed': 'Обновления установлены', 'Everything is up to date': 'Всё актуально',
    'Installing Fabric API': 'Установка Fabric API', 'Installing Lumen HUD': 'Установка Lumen HUD',

    // ----- errors from the core
    'Add an account in Settings first': 'Сначала добавьте аккаунт в настройках', 'Choose a .mrpack file': 'Выберите файл .mrpack', 'Close the game first': 'Сначала закройте игру',
    'Close the game first so its files are not changing while they are copied': 'Сначала закройте игру, чтобы её файлы не менялись во время копирования',
    'Close the game first, then switch packs': 'Сначала закройте игру, потом переключайте паки', 'Export files must end in .mrpack': 'Файл экспорта должен заканчиваться на .mrpack',
    'Instance is running': 'Сборка запущена', 'Nickname must be 3–16 letters, digits or _': 'Ник: от 3 до 16 символов — латинские буквы, цифры или _',
    'Not a Modrinth modpack (modrinth.index.json is missing)': 'Это не модпак Modrinth (нет файла modrinth.index.json)', 'Not a crash report': 'Это не отчёт о вылете', 'Not a screenshot': 'Это не скриншот',
    'Only resource packs and shader packs can be switched on': 'Включать можно только ресурспаки и шейдеры', 'The modpack does not say which Minecraft version it needs': 'В модпаке не указана нужная версия Minecraft',
    'The modpack index is corrupted': 'Описание модпака повреждено', 'The modpack is unreasonably large': 'Модпак подозрительно большой', 'This file is not a valid modpack archive': 'Этот файл не является корректным архивом модпака',
    'Unsupported modpack format': 'Неподдерживаемый формат модпака',
  };

  const patterns = [
    [/^Connected\. (\d+) players? on the service\.$/, (a) => `Подключено. Игроков на сервисе: ${a}.`],
    // ----- time and sizes
    [/^(\d+)m ago$/, (a) => `${a} мин назад`], [/^(\d+)h ago$/, (a) => `${a} ч назад`], [/^(\d+)d ago$/, (a) => `${a} дн. назад`],
    [/^((?:\d+h )?\d+m) played$/, (t) => `${time(t)} в игре`], [/^((?:\d+h )?\d+m)$/, (t) => time(t)], [/^([\d.]+ (?:GB|MB|KB))$/, (s) => gb(s)],
    [/^(\d+) GB in system$/, (a) => `${a} ГБ в системе`], [/^Last played (.+)$/, (a) => `Последний запуск: ${sub(a)}`],
    [/^(Good night|Good morning|Good afternoon|Good evening), (.+)$/, (g, name) => `${greetings[g]}, ${name === 'player' ? 'игрок' : name}`],

    // ----- counts
    [/^(\d+) modules active$/, (a) => `Модулей: ${a}`], [/^(\d+) mods$/, (a) => n(a, 'мод', 'мода', 'модов')],
    [/^(\d+) updates$/, (a) => n(a, 'обновление', 'обновления', 'обновлений')], [/^(\d+) updates available$/, (a) => `Доступно обновлений: ${a}`], [/^Update all \((\d+)\)$/, (a) => `Обновить всё (${a})`],
    [/^(\d+) of (\d+) active · one click to install, with dependencies resolved automatically\.$/, (a, b) => `Включено ${a} из ${b} · установка в один клик, зависимости подтягиваются сами.`],
    [/^(\d+) shots from (.+) · press F2 in-game to take one\.$/, (a, name) => `${n(a, 'скриншот', 'скриншота', 'скриншотов')} из «${name}» · нажмите F2 в игре, чтобы сделать новый.`],
    [/^Load more · (.+) left$/, (a) => `Показать ещё · осталось ${a}`], [/^(.+) \/ (.+) online$/, (a, b) => `${a} / ${b} онлайн`],
    [/^(\d+) will be updated$/, (a) => `Будет обновлено: ${a}`], [/^(\d+) will be switched off$/, (a) => `Будет выключено: ${a}`], [/^to builds for (.+)$/, (a) => `до сборок под ${a}`],
    [/^— no build for (.+) yet$/, (a) => `— пока нет сборки под ${a}`], [/^— it isn't available for (.+) yet$/, (a) => `— для ${a} его пока нет`],
    [/^(.+), \+(\d+) more$/, (a, b) => `${a}, ещё ${b}`], [/^No (.+) build$/, (a) => `Нет сборки под ${a}`],

    // ----- headings and sentences with names
    [/^Everything in (.+)\. Toggle without deleting, update with one click\.$/, (a) => `Всё, что есть в «${a}». Включайте и выключайте без удаления, обновляйте одним кликом.`],
    [/^Thousands of mods, resource packs and shaders from Modrinth — filtered for (.+) (Fabric|Vanilla)\.$/, (v, l) => `Тысячи модов, ресурспаков и шейдеров с Modrinth, отфильтрованные для ${v} ${l}.`],
    [/^Live status and one-click join with your selected instance(?: \((.+)\))?\.$/, (a) => `Статус в реальном времени и вход в один клик с выбранной сборкой${a ? ` (${a})` : ''}.`],
    [/^Supports (.+) · (.*) latest · (.*)$/, (l, v, lic) => `Поддерживает: ${l} · последняя версия: ${v} · лицензия: ${lic}`],
    [/^Install to (.+)$/, (a) => `Установить в «${a}»`], [/^Not available for (.+)$/, (a) => `Недоступно для ${a}`],
    [/^Create an instance to (.+)\.$/, (what) => `Создайте сборку, чтобы ${dropKind[what] || what}.`], [/^No (mods|resource packs|shaders) yet$/, (k) => `Пока нет: ${kinds[k]}`],
    [/^Filter (mods|resource packs|shaders)$/, (k) => `Поиск: ${kinds[k]}`], [/^Search (mods|resource packs|shaders)…$/, (k) => `Поиск: ${kinds[k]}…`],
    [/^(.*) · needed by (.+)$/, (a, b) => `${a} · нужен для: ${b}`], [/^(Release|Snapshot) (.+)$/, (k, v) => `${k === 'Release' ? 'Релиз' : 'Снапшот'} ${v}`],
    [/^Offline · (.+)$/, (a) => `Оффлайн · ${a}`], [/^Lumen Client (.+) · Not affiliated with Mojang or Microsoft\.$/, (v) => `Lumen Client ${v} · Не связан с Mojang и Microsoft.`],
    [/^(.+) size$/, (a) => `Размер: ${sub(a)}`], [/^Free (.+)$/, (a) => `Освободить ${gb(a)}`], [/^Could not measure: (.+)$/, (a) => `Не удалось измерить: ${sub(a)}`],
    [/^Lumen HUD runs on Fabric (.+)\.$/, (a) => `Lumen HUD работает на Fabric ${a}.`], [/^Lumen HUD is not installed in (.+)\.$/, (a) => `Lumen HUD не установлен в «${a}».`],
    [/^(.+) is (\S+) (Fabric|Vanilla)\. Create a HUD-ready instance in one click\.$/, (name, v, l) => `«${name}» — это ${v} ${l}. Создайте сборку с поддержкой HUD в один клик.`],
    [/^(?:(\d+) unused versions? \((.*?)\))?(?: and )?(?:(\d+) unused Java runtimes?)?\. They are downloaded again if you ever need them\.$/, (v, list, j) => {
      const parts = [];
      if (v) parts.push(`${n(v, 'неиспользуемая версия', 'неиспользуемые версии', 'неиспользуемых версий')} (${list})`);
      if (j) parts.push(n(j, 'неиспользуемая среда Java', 'неиспользуемые среды Java', 'неиспользуемых сред Java'));
      return `${parts.join(' и ')}. Они скачаются снова, если понадобятся.`;
    }],

    // ----- instance dialogs
    [/^(.+) \(snapshot\)$/, (a) => `${a} (снапшот)`], [/^— empty = global \((\d+) MB\)$/, (a) => `— пусто = общая (${a} МБ)`], [/^([\w.+-]+) · (Fabric|Vanilla)$/, (v, l) => `${v} · ${l}`],
    [/^([\d.]+) GB is a good amount for this many mods\.$/, (a) => `${a} ГБ — хороший объём для такого числа модов.`], [/^Use ([\d.]+) GB$/, (a) => `Выбрать ${a} ГБ`],
    [/^Duplicate (.+)$/, (a) => `Дублировать «${a}»`], [/^Delete (.+)\?$/, (a) => `Удалить «${a}»?`], [/^Move (.+) to (.+)\?$/, (a, b) => `Перенести «${a}» на ${b}?`],
    [/^Mods built for (.+) would stop the game from starting, so they are updated for you\. Your worlds are not touched\.$/, (a) => `Моды, собранные под ${a}, не дадут игре запуститься, поэтому мы обновим их за вас. Ваши миры не затрагиваются.`],
    [/^Drop files to add them to (.+)$/, (a) => `Перетащите файлы, чтобы добавить их в «${a}»`],
    [/^Give it (.+) & play again$/, (a) => `Выделить ${gb(a)} и запустить снова`],
    [/^It was given (.+) and needed more(, which is common with this many mods)?\.(?: Your computer only has (.+) in total, so there is no safe way to give it more\. Removing some mods will help\.)?$/,
      (a, many, total) => `Игре выделено ${gb(a)}, и этого не хватило${many ? ' (с таким числом модов это обычное дело)' : ''}.${total ? ` Всего в компьютере ${gb(total)}, поэтому безопасно выделить больше нельзя. Поможет удаление части модов.` : ''}`],
    [/^— (.+) is missing and will be downloaded again$/, (a) => `— файл ${a} отсутствует и будет скачан заново`], [/^— required by (.+), will be installed$/, (a) => `— нужен для: ${a}; будет установлен`],

    // ----- toasts and task labels
    [/^Created (.+)$/, (a) => `Создана сборка «${a}»`], [/^(Installed|Imported) (.+) \((\d[\w.]*(?: Fabric)?)\)$/, (verb, name, v) => `${verb === 'Installed' ? 'Установлена' : 'Импортирована'} сборка «${name}» (${v})`],
    [/^Installed (.+)$/, (a) => `Установлено: ${a}`], [/^Installing (.+)$/, (a) => `Установка: ${a}`], [/^Updating (.+)$/, (a) => `Обновление: ${a}`], [/^Enabling (.+)$/, (a) => `Включение: ${a}`],
    [/^Moving to (.+)$/, (a) => `Переход на ${a}`], [/^Downloading (.+)$/, (a) => /^\d+\/\d+ files$/.test(a) ? `Загрузка файлов: ${a.replace(' files', '')}` : `Загрузка: ${a}`],
    [/^Preparing (\d+\/\d+)$/, (a) => `Подготовка: ${a}`], [/^Fetching Minecraft (.+)$/, (a) => `Получение данных Minecraft ${a}`], [/^Fetching Fabric (.+)$/, (a) => `Получение Fabric ${a}`],
    [/^Downloading Java \((.+)\)$/, (a) => `Загрузка Java (${a})`],
    [/^(.+) enabled \(\+(\d+) dependenc(?:y|ies)\)$/, (a, b) => `${a} включён (+${n(b, 'зависимость', 'зависимости', 'зависимостей')})`], [/^(.+) enabled$/, (a) => `${a} включён`],
    [/^(.+) disabled \(\+(\d+) unused dependenc(?:y|ies) removed\)$/, (a, b) => `${a} выключен (удалено лишних зависимостей: ${b})`], [/^(.+) disabled$/, (a) => `${a} выключен`],
    [/^Also removed (\d+) unused dependenc(?:y|ies)$/, (a) => `Заодно удалено лишних зависимостей: ${a}`], [/^Essentials installed, skipped: (.+)$/, (a) => `Базовый набор установлен, пропущено: ${a}`],
    [/^Fabric does not support (?:Minecraft )?(.+)$/, (a) => `Fabric не поддерживает ${a}`], [/^(.+) is now active in (.+)$/, (a, b) => `${a} теперь включён в «${b}»`], [/^(.+) switched off$/, (a) => `${a} выключен`],
    [/^Freed (.+)$/, (a) => `Освобождено ${gb(a)}`], [/^Exported (\d+) mods(?: and (\d+) bundled files)?$/, (a, b) => `Экспортировано модов: ${a}${b ? ` и вложенных файлов: ${b}` : ''}`],
    [/^Added (.+) to (.+)$/, (a, b) => `Добавлено в «${b}»: ${a}`], [/^Game exited with code (\d+) — check the Console$/, (a) => `Игра завершилась с кодом ${a}: загляните в консоль`],
    [/^Moved to (.+?) · (\d+) updated(?: · (\d+) switched off \(no (.+?) build\): (.+))?$/, (v, up, off, ver, list) => `Переход на ${v} · обновлено: ${up}${off ? ` · выключено (нет сборки под ${ver}): ${list}` : ''}`],
    [/^Something went wrong: (.+)\. Details are in launcher\.log \(Settings → Storage\)\.$/, (a) => `Что-то пошло не так: ${sub(a)}. Подробности — в launcher.log (Настройки → Хранилище).`],
    [/^Search failed: (.+)$/, (a) => `Поиск не удался: ${sub(a)}`], [/^Could not fix: (.+)$/, (a) => `Не удалось исправить: ${sub(a)}`], [/^Could not install: (.+)$/, (a) => `Не удалось установить: ${sub(a)}`],
    [/^Could not load versions: (.+)$/, (a) => `Не удалось загрузить список версий: ${sub(a)}`],

    // ----- errors from the core
    [/^(.+) is required by (.+)\. Remove those first\.$/, (a, b) => `«${a}» нужен для: ${b}. Сначала удалите их.`], [/^(.+) has no Fabric version$/, (a) => `У «${a}» нет версии для Fabric`],
    [/^(.+) is not available for (.+)$/, (a, b) => `«${a}» недоступен для ${b}`], [/^(.+) is not distributed as a \.mrpack$/, (a) => `«${a}» не распространяется как .mrpack`],
    [/^Checksum mismatch for (.+)$/, (a) => `Контрольная сумма не совпала: ${a}`], [/^Could not download (.+?): (.+)$/, (a, b) => `Не удалось скачать ${a}: ${sub(b)}`],
    [/^HTTP (\d+) for (.+)$/, (a, b) => `Ошибка HTTP ${a}: ${b}`], [/^Lumen HUD supports Fabric (.+) for now$/, (a) => `Пока Lumen HUD поддерживает Fabric ${a}`],
    [/^No Java runtime "(.+)" for (.+)$/, (a, b) => `Нет среды Java «${a}» для ${b}`], [/^No checksum for (.+)$/, (a) => `Нет контрольной суммы для ${a}`],
    [/^No trusted download source for (.+)$/, (a) => `Нет надёжного источника загрузки для ${a}`], [/^Required dependency (.+) has no build for (.+)$/, (a, b) => `У обязательной зависимости «${a}» нет сборки под ${b}`],
    [/^This pack needs (.+), which Lumen can't launch yet\. Only Fabric and vanilla packs work\.$/, (a) => `Этому модпаку нужен ${a}, который Lumen пока не умеет запускать. Работают только Fabric и vanilla.`],
    [/^Unknown Minecraft version (.+)$/, (a) => `Неизвестная версия Minecraft: ${a}`], [/^Unsafe path in modpack: (.+)$/, (a) => `Опасный путь в модпаке: ${a}`],
    [/^(.+) is not a valid \.jar\/\.zip archive$/, (a) => `${a}: это не корректный архив .jar/.zip`], [/^(.+) is a mod, but this instance is vanilla\. Switch it to Fabric first$/, (a) => `${a} — это мод, но сборка чистая (vanilla). Сначала переключите её на Fabric`],
    [/^(.+) isn't a Fabric mod \(it looks like a Forge\/NeoForge mod, which can't run here\)$/, (a) => `${a} — не мод для Fabric (похоже на мод Forge/NeoForge, он здесь не заработает)`],
    [/^(.+) isn't a resource pack or shader pack \(no pack\.mcmeta or shaders folder\)$/, (a) => `${a} — не ресурспак и не шейдер (нет pack.mcmeta или папки shaders)`],
    [/^(.+) has an unsupported type \((.+)\); use \.jar, \.zip or \.mrpack$/, (a, b) => `${a}: неподдерживаемый тип (${b}); используйте .jar, .zip или .mrpack`],
  ];

  const pack = { dict, patterns, bind: (fn) => { translate = fn; } };
  root.LUMEN_PACKS = root.LUMEN_PACKS || {};
  root.LUMEN_PACKS.ru = pack;
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
})(typeof window !== 'undefined' ? window : globalThis);
