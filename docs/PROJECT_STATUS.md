# MuseLab – Project status and progress

Snapshot of the project state and what is implemented. See [PLAN.md](./PLAN.md) for the original plan.

---

## Progress overview

| Step | Plan item | Status | Notes |
|------|-----------|--------|------|
| 1 | Scaffold: Vite + React + TS, Electron | Done | Single package, `npm run dev` (web), `npm run electron:dev` (desktop) |
| 2 | Core model: types, project, save/load JSON | Done | `src/core/model/`, Zustand store with localStorage |
| 3 | AntV X6: custom node, native edges, persist positions | Done | `FlowCanvas`, `StoryNode`, `src/x6/`; project is source of truth |
| 4 | Node editor: backdrop, actors, sounds, template | Done | `NodeEditorPanel` with sound config (start/stop/loop/start/end time) |
| 5 | Edge editor: option text and condition | Done | `EdgeEditorPanel`; option text on edge label |
| 6 | Template engine: Cito compile + cito transpile, sanitized HTML | Done | `src/core/cito/`, `src/core/template/engine.ts` – Cito in `{{ }}`, DOMPurify allowlist |
| 7 | Asset layer: resolver, file picker (Electron + Web) | Done | `resolver.ts`, `AssetsPanel`, Electron IPC for dialogs and path→URL |
| 8 | Player: navigation, conditions, choices, sound | Done | `PlayerView`, `runner.ts`, SoundManager, `playSound` from template |
| 9 | Polish: drag-drop, start/stop on load, invoke sound | Done | Drag-drop in AssetsPanel; start/stop on load and `playSound('id')` wired |

All planned steps are implemented.

---

## Current structure

```
MuseLab/
├── docs/
│   ├── PLAN.md           # Original plan (this snapshot)
│   └── PROJECT_STATUS.md  # This file
├── electron/
│   ├── main.ts           # Window, IPC: open-file-dialog, resolve-asset-url
│   └── preload.ts        # contextBridge: electronAPI
├── src/
│   ├── core/
│   │   ├── assets/
│   │   │   └── resolver.ts    # getAssetUrlSync, getAssetUrlAsync
│   │   ├── model/
│   │   │   ├── types.ts      # Project, StoryNode, StoryEdge, Asset, SoundConfig
│   │   │   └── project.ts    # CRUD, serialize/parse, getEntryNodeId
│   │   ├── runtime/
│   │   │   └── runner.ts     # createRunner, state, template run, choices
│   │   └── template/
│   │       ├── engine.ts     # runTemplate, evaluateCondition
│   │       ├── sandbox.ts    # evaluateExpression, TemplateContext
│   │       └── sanitize.ts   # DOMPurify allowlist (b,i,p,div,br,span)
│   ├── components/
│   │   ├── AssetsPanel.tsx   # Add/remove assets; drag-drop (web); file picker
│   │   ├── FlowCanvas.tsx    # AntV X6 graph, project sync, add node, connect
│   │   ├── StoryNode.tsx     # X6 React shape (label, preview, backdrop)
│   │   ├── x6/
│   │   │   ├── registerShapes.ts
│   │   │   ├── graphOptions.ts
│   │   │   └── syncProjectToGraph.ts
│   │   ├── NodeEditor/
│   │   │   └── NodeEditorPanel.tsx  # Label, backdrop, actors, sounds, template
│   │   └── EdgeEditor/
│   │       └── EdgeEditorPanel.tsx  # Option text, condition
│   ├── hooks/
│   │   └── useAssetUrl.ts    # Resolve asset ID to URL (sync + async for Electron)
│   ├── store/
│   │   └── projectStore.ts   # Zustand: project, selection, CRUD, localStorage
│   ├── views/
│   │   ├── DesignerView.tsx  # AssetsPanel + FlowCanvas + Node/Edge panels
│   │   └── PlayerView.tsx    # Stage, choices, SoundManager
│   ├── App.tsx               # Routes: /, /play
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts            # React + conditional vite-plugin-electron
└── README.md
```

---

## How to run

- **Web**: `npm run dev` → open app, use Designer at `/`, Player at `/play`.
- **Build**: `npm run build` → `dist/` (web).
- **Electron**: `npm run electron:dev` → one window, file dialogs and asset paths via main process.

---

## Data and persistence

- **Project**: Stored in Zustand; persisted to `localStorage` under key `muselab-project` (web). Electron can be extended later to save/load files via IPC.
- **Assets**: Web = blob/object URLs in project JSON; Electron = file paths, resolved to `file://` URLs via main process.

---

## Template API (player)

Cito expressions in `{{ }}` blocks and edge conditions. Runtime bridge `rt`:

- `rt.GetString(key)` / `rt.GetBool(key)` / `rt.GetInt(key)` – read state
- `rt.SetString(key, value)` / `rt.SetBool` / `rt.SetInt` – write state on node enter
- `rt.Emit(eventName)` – fire event
- `rt.Call(name)` – call registered handler
- `rt.PlaySound(assetId)` / `rt.PlaySoundTrim(assetId, start, end)` – play sound
- `Format.BoldStart()`, `Format.ColorStart("#hex")`, etc. – markup directives

See [docs/cito-templates.md](cito-templates.md). HTML output allowlist: `b`, `i`, `p`, `div`, `br`, `span` (DOMPurify).

---

## Possible next steps (not in original plan)

- Save/load project file in Electron (dialog + path).
- Designate explicit “entry node” in the UI.
- Export project to a standalone player bundle.
- Tests for core (model, template, runner).
