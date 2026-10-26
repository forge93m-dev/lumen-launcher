# Lumen Client

A Minecraft launcher + client in the spirit of Feather/Lunar, built on Electron and Fabric.

## Run
```
npm install
npm start
```

## Features
- **One-click PLAY** — downloads Minecraft, the correct Java runtime (from Mojang), libraries, assets and Fabric automatically.
- **Lumen HUD** — our own Fabric mod (`hud-mod/`): FPS, CPS, ping, speed, clock, keystrokes, coordinates, armor, potion effects, reach, combo, memory, session time, item counter (totems, golden apples, pearls, crystals), target info (name + health), server address and sprint status. Client features switched in the HUD Editor: **Toggle sprint**, **Fullbright**, **Zoom** (hold C). Edit the layout in the launcher's **HUD Editor** (drag, scroll, right-click, colours); changes apply live in-game. Right Shift opens the in-game editor. Fabric 1.21, 1.21.1, 1.21.4, 1.21.8, 1.21.11 and 26.1 / 26.2 / 26.3 (`hud-mod/mc1.21`, `hud-mod/mc26`, shared code in `hud-mod/common`).
- **Modpacks** — browse Modrinth Fabric modpacks and install one as its own instance with one click; import or export `.mrpack` files (untrusted packs are validated: no path traversal, trusted download hosts only, checksums verified).
- **Launch doctor** — before Play it catches deleted jars and missing dependencies; if Fabric refuses to start it reads the error, finds the missing mod on Modrinth and installs it; out-of-memory crashes offer a bigger heap; real crashes link to the crash report.
- **Change Minecraft version safely** — shows a preview, updates every mod to its new-version build and switches off the ones that have none.
- **Auto update check** — one batched request, with a badge on *Installed*.
- **Drag & drop** — drop .jar mods, resource packs, shader packs or a .mrpack on the window.
- **Packs in one click** — switch resource packs and shader packs on from *Installed* (writes the game's own settings; offers to install Iris when needed).
- **Duplicate** an instance (optionally with worlds) to experiment safely; the window remembers its size and position; the console has a live filter.
- **Works offline** once an instance has been launched.
- **Servers in the game too** — the servers you save in the launcher are added to the game's own multiplayer list (existing entries are never changed).
- **Screenshots** — copy to clipboard, show in folder, delete (to the Recycle Bin). **Recommended RAM** is suggested per instance from its mod count.
- **Installed** has a filter and shows which mods need which (so nothing is deleted by mistake). **Settings → Storage** shows what takes space and frees unused game versions/Java. Uncaught errors go to `launcher.log` instead of crashing the launcher.
- **Languages** — English and Russian (Settings → Language, or follow the system). Packs live in `renderer/lang/`; a test fails if new English text ships without a translation.
- **Client Modules** — 30 curated toggles (Sodium, Lithium, Zoom, Iris shaders, Minimap, AppleSkin, Better F3, Dynamic Lights…), with "Enable essentials" preset.
- **Browse** — search Modrinth mods, resource packs and shaders filtered for your instance; dependencies install automatically.
- **Installed** — enable/disable without deleting, one-click updates, manual jar support.
- **Instances** — separate game folders with their own version, loader, RAM and JVM args.
- **Servers** — live status (players, MOTD, icon) and direct Join (quick play).
- **Screenshots** gallery, live **Console** with colored logs, playtime tracking, accent themes.

Data lives in `%APPDATA%\LumenClient`. Offline accounts only for now.

## Installer

```
npm run dist       # dist/Lumen Client Setup <version>.exe and dist/Lumen-Client-<version>-portable.exe
npm run dist:dir   # unpacked app in dist/win-unpacked
```

The builds are not code-signed, so Windows SmartScreen asks for confirmation on first start.

## Rebuilding Lumen HUD
```
npm run build:hud
```
Builds both Lumen HUD versions with Gradle + Fabric Loom and copies the jars into `mods/`, which the launcher installs into instances.

## Tests
```
npm test          # fast, offline unit tests
npm run test:ui   # launches the app in Electron (every page, both languages, spam-proofing)
npm run test:net  # real Modrinth (installs, dependencies, update check, modpacks, version change)
npm run test:game # starts the real game (downloads Minecraft on the first run)
```
Tests never touch your real data folder. `LUMEN_HOME` moves the data folder (portable install).
