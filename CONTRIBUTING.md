# Contributing to MuseLab

This document is for developers who want to work on the MuseLab codebase.

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** (or pnpm / yarn)

## Tech stack

- **Frontend:** React 18, React Router, Zustand, AntV X6
- **Build:** Vite 6, TypeScript
- **Desktop:** Electron (main + preload; file dialogs, `.mlvn` save/load, asset protocol)

## Getting the code running

```bash
git clone https://github.com/BEllis/MuseLab.git
cd MuseLab
npm install
```

## Commands

| Command                 | Description                          |
|-------------------------|--------------------------------------|
| `npm run dev`           | Web dev server (Vite) at localhost   |
| `npm run build`         | Production build (web)               |
| `npm run preview`       | Serve production build locally      |
| `npm run electron:dev`  | Run app in Electron with HMR         |
| `npm run electron:build`| Build desktop app (Electron + electron-builder) |
| `npm run icons`         | Regenerate `build/icon.png` and `build/icon.ico` from `src/assets/logo.png` |

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
│   ├── main.ts         # App menu, IPC (file dialogs, .mlvn save/load, asset protocol)
│   └── preload.ts      # contextBridge API for renderer
├── build/              # Electron app icons (icon.png, icon.ico)
├── package.json
└── README.md
```

- **Designer:** `FlowCanvas` (nodes/edges), `NodeEditorPanel`, `EdgeEditorPanel`, `AssetsPanel`.
- **Core:** `project` (nodes, edges, assets, globalState), `serializeProject` / `parseProject`, template evaluation, runtime runner for the player.

## Implementation notes

- **Text templates:** Handlebars-style `{{ expression }}`, `{{#if condition}}...{{/if}}`. Helpers: `state`, `setState(path, value)`, `emit(event)`, `call(name, ...args)`, `playSound(assetId, options)`.
- **Assets:** File picker in Electron; asset protocol for resolving paths in the player.
- **Auto layout:** New or moved nodes are nudged so they don’t overlap.
