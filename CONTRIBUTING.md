# Contributing to MuseLab

This document is for developers who want to work on the MuseLab codebase.

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** (or pnpm / yarn)
- **.NET 6 SDK** (to build the cito transpiler: `npm run build:cito`)

## Tech stack

- **Frontend:** React 18, React Router, Zustand, AntV X6
- **Build:** Vite 6, TypeScript
- **Desktop:** Electron (main + preload; file dialogs, `.mlvn` save/load, asset protocol)

## Getting the code running

```bash
git clone https://github.com/BEllis/MuseLab.git
cd MuseLab
git clone https://github.com/Marco012/cito.git third_party/cito
npm install
npm run build:cito
```

## Commands

| Command                 | Description                          |
|-------------------------|--------------------------------------|
| `npm run dev`           | Web dev server (Vite) at localhost   |
| `npm run build`         | Production build (web)               |
| `npm run preview`       | Serve production build locally      |
| `npm run electron:dev`  | Run app in Electron with HMR         |
| `npm run electron:build`| Build desktop app (Electron + electron-builder) |
| `npm run build:cito`    | Build Marco012/cito into `tools/cito/` |
| `npm run test`          | Run Vitest unit tests                  |
| `npm run icons`         | Regenerate app icons from logo         |

- **Web:** `npm run dev` then open the URL (e.g. `http://localhost:5173`). Designer at `/`, player at `/play`.
- **Desktop:** `npm run electron:dev`.

## Project layout

```
MuseLab/
├── src/
│   ├── components/     # FlowCanvas, StoryNode, panels, etc.
│   ├── x6/             # X6 graph config, shape registration, project sync
│   ├── views/          # DesignerView, PlayerView
│   ├── store/          # projectStore (Zustand)
│   ├── core/           # Model, template engine, runtime, assets (no DOM)
│   └── hooks/          # useAssetUrl, etc.
├── electron/
│   ├── main.ts         # App menu, IPC (file dialogs, cito transpile, .mlvn)
│   ├── citoTranspile.ts
│   └── preload.ts      # contextBridge API for renderer
├── third_party/cito/   # Marco012/cito (clone; npm run build:cito)
├── tools/cito/         # Built transpiler output (gitignored)
├── build/              # Electron app icons (icon.png, icon.ico)
├── package.json
└── README.md
```

- **Designer:** `FlowCanvas` (nodes/edges), `NodeEditorPanel`, `EdgeEditorPanel`, `AssetsPanel`.
- **Core:** `project` (nodes, edges, assets, globalState), `serializeProject` / `parseProject`, template evaluation, runtime runner for the player.

## Implementation notes

- **Text templates:** HTML with embedded **Cito** in `{{ }}` blocks; structural `{{#if}}…{{/if}}`. Runtime API: `rt.GetString/GetBool/GetInt`, `rt.SetString/SetBool/SetInt`, `rt.Emit`, `rt.Call`, `rt.PlaySound`, and `Format.*` markup. Templates compile to `.ci` and transpile to JavaScript via [cito](https://github.com/Marco012/cito) in the Electron main process. See [docs/cito-templates.md](docs/cito-templates.md).
- **Assets:** File picker in Electron; asset protocol for resolving paths in the player.
- **Auto layout:** New or moved nodes are nudged so they don’t overlap.
