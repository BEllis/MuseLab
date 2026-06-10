# MuseLab – Project status and progress

Snapshot of the project state and what is implemented. See [PLAN.md](./PLAN.md) for the original plan (historical reference).

---

## Progress overview

| Step | Plan item | Status | Notes |
|------|-----------|--------|------|
| 1 | Scaffold: Vite + React + TS, Electron | Done | Single package, `npm run dev` (web), `npm run electron:dev` (desktop) |
| 2 | Core model: types, project, save/load | Done | `src/core/model/`, Zustand store; `.mlvn` zip archives + legacy JSON import |
| 3 | AntV X6: custom node, native edges, persist positions | Done | `FlowCanvas`, `StoryNode`, `src/x6/`; project is source of truth |
| 4 | Node editor: backdrop, actors, sounds, template | Done | `NodeEditorPanel` with sound config, locale prompts, speaker field |
| 5 | Edge editor: option text and condition | Done | `EdgeEditorPanel`; option text on edge label |
| 6 | Template engine: Cito compile + cito transpile, sanitized HTML | Done | `src/core/cito/`, `src/core/template/engine.ts` – Cito in `{{ }}`, DOMPurify allowlist |
| 7 | Asset layer: resolver, file picker (Electron + Web) | Done | `resolver.ts`, `AssetsPanel`, Electron IPC + `asset://` protocol; web IndexedDB blobs |
| 8 | Player: navigation, conditions, choices, sound | Done | `PlayerView`, `runner.ts`, locale switching, `playSound` from template |
| 9 | Polish: drag-drop, start/stop on load, invoke sound | Done | Drag-drop in AssetsPanel; start/stop on load and `rt.PlaySound(...)` wired |

All planned steps are implemented. Post-plan work includes multi-story projects, locales, `.mlvn` archives, undo/redo, themes, and unit tests.

---

## Current structure

```
MuseLab/
├── docs/
│   ├── PLAN.md              # Original plan (historical)
│   ├── PROJECT_STATUS.md    # This file
│   ├── cito-templates.md    # Cito template syntax reference
│   └── prompts/             # AI agent prompts (e.g. story generator)
├── electron/
│   ├── main.ts              # Window, menu, IPC: file dialogs, cito transpile, .mlvn
│   ├── preload.ts           # contextBridge: electronAPI
│   ├── citoTranspile.ts     # Invoke bundled cito subprocess
│   ├── assetProtocol.ts     # asset:// URL handler
│   └── userSettings.ts      # Persisted theme preference
├── scripts/
│   └── build-cito.sh        # Build third_party/cito → tools/cito/
├── src/
│   ├── cito/                # MuseLabRuntime.ci, Format.ci (cito compile stubs)
│   ├── core/
│   │   ├── assets/          # resolver, hydration, web storage, default backdrop
│   │   ├── cito/            # compileTemplate, compileCondition, transpile, formatRuntime
│   │   ├── history/         # Undo/redo for project edits
│   │   ├── locale/          # Locale tags, prompts.<locale>.json read/write
│   │   ├── model/           # Project, Story, StoryNode, StoryEdge, Asset
│   │   ├── project/         # .mlvn archive pack/unpack, file actions
│   │   ├── runtime/         # runner.ts – player state, choices, template run
│   │   ├── template/        # engine.ts, sanitize.ts
│   │   └── view/            # theme, player resolution, scene stage helpers
│   ├── components/          # FlowCanvas, panels, StoryNode, MenuBar, etc.
│   ├── x6/                  # X6 graph config, shape registration, project sync
│   ├── views/               # DesignerView, PlayerView
│   ├── store/               # projectStore, themeStore, aboutStore
│   └── hooks/               # useAssetUrl, useActiveStory
├── third_party/cito/        # Marco012/cito (git submodule)
├── tools/cito/              # Built transpiler output (gitignored)
├── muselab.story.schema.json
├── muselab.prompts.schema.json
├── muselab.bundle.schema.json
├── muselab.mlvn.schema.json
└── README.md
```

---

## How to run

- **Web:** `npm run dev` → Designer at `/`, Player at `/play`. Save/load via browser download and file picker (`.mlvn` or legacy `.json`).
- **Web deploy (PWA):** `npm run build:web-deploy` → `dist-deploy/` with service worker precaching app shell + Cito WASM for offline use at `/designer/` after first visit.
- **Build:** `npm run build` → `dist/` (web).
- **Electron:** `npm run electron:dev` → native file dialogs, cito transpilation, `asset://` URLs.
- **Tests:** `npm run test` (Vitest).
- **Cito transpiler:** `npm run build:cito` (requires .NET 6 SDK and `third_party/cito` submodule).

Template evaluation requires Electron (cito runs in the main process). Browser-only `npm run dev` cannot evaluate Cito templates.

---

## Data and persistence

- **Project model:** `Project` contains `assets`, `stories[]` (each with `nodes`, `edges`, `globalState`), and `locales`. Dialogue and choice labels live in per-locale `prompts.<locale>.json` files, not inline on nodes/edges.
- **Web:** Zustand state persisted to `localStorage` (`muselab-project`). Assets stored in IndexedDB. Save exports a `.mlvn` zip download. Deployed web build (`build:web-deploy`) registers a service worker that precaches the app and WASM for offline editing.
- **Electron:** Save/load `.mlvn` via native dialogs; legacy plain `.json` import supported. Assets resolved via `asset://` protocol or file paths.
- **`.mlvn` archive:** `project.json` manifest + `prompts.<locale>.json` + `assets/{backdrops,actors,sounds}/`.

---

## Template API (player)

Cito expressions in `{{ }}` blocks and edge conditions. Runtime bridge `rt`:

- `rt.GetString(key)` / `rt.GetBool(key)` / `rt.GetInt(key)` – read state
- `rt.SetString(key, value)` / `rt.SetBool` / `rt.SetInt` – write state on node enter
- `rt.Emit(eventName)` – fire event
- `rt.Call(name)` – call registered handler
- `rt.PlaySound(assetId)` / `rt.PlaySoundTrim(assetId, start, end)` – play sound
- `Format.BoldStart()`, `Format.ColorStart("#hex")`, shake helpers, etc. – markup directives

See [docs/cito-templates.md](cito-templates.md). HTML output allowlist: `b`, `i`, `p`, `div`, `br`, `span` with `class` and `style` (DOMPurify).

---

## Features beyond the original plan

| Feature | Status |
|---------|--------|
| `.mlvn` zip save/load (web + desktop) | Done |
| Multi-story projects (`stories[]`) | Done |
| Locales + `prompts.<locale>.json` | Done |
| Cito templates (replaced JS sandbox) | Done |
| Undo/redo (Ctrl/Cmd+Z, Shift+Z) | Done |
| Light/dark theme | Done |
| Play validation (entry node, reachability) | Done |
| Unit tests (cito compile, locale, archive) | Done |
| Browser PWA offline (service worker + installable manifest) | Done |
| Scene speaker field (per locale) | Done |
| Player locale picker | Done |

---

## Possible next steps

- ~~Browser-side cito transpilation (WASM) so templates work without Electron.~~ Done (WASM + PWA precache for offline).
- Export project to a standalone player bundle.
- Broader test coverage (runner, model CRUD).
- Explicit entry-node picker in the designer UI.
