# Contributing to MuseLab

This document is for developers who want to work on the MuseLab codebase.

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** 10+
- **.NET 6 SDK** (to build the cito transpiler: `pnpm build:cito`)
- **.NET 8 SDK** (optional, to rebuild cito WASM: `pnpm --filter @muselab/designer run build:cito-wasm`)

## Tech stack

- **Frontend:** React 18, React Router, Zustand, AntV X6
- **Build:** Vite 6, TypeScript, Turborepo, pnpm workspaces
- **Desktop:** Electron (main + preload; file dialogs, `.mlvn` save/load, asset protocol)
- **Deploy:** Cloudflare Workers + Wrangler (`infra/muselab-site`)
- **Unity scaffold:** Unity 6 project at `scaffolds/unity/MuseLab/`

## Getting the code running

```bash
git clone https://github.com/BEllis/MuseLab.git
cd MuseLab
git submodule update --init --recursive   # third_party/cito
pnpm install
pnpm build:cito
```

## Commands (from repo root)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Web dev server (Vite) at localhost |
| `pnpm build` | Production build (all packages) |
| `pnpm preview` | Serve production build locally |
| `pnpm electron:dev` | Run app in Electron with HMR |
| `pnpm electron:build` | Build desktop app (Electron + electron-builder) |
| `pnpm build:cito` | Build Marco012/cito into `tools/cito/` |
| `pnpm test` | Run Vitest unit tests |
| `pnpm deploy` | Build site bundle and deploy to Cloudflare |
| `pnpm icons` | Regenerate app icons from logo |

- **Web:** `pnpm dev` then open the URL (e.g. `http://localhost:5173`). Designer at `/`, player at `/play`.
- **Desktop:** `pnpm electron:dev`.
- **Unity:** Open `scaffolds/unity/MuseLab/MuseLab.sln` in Unity Editor 6.

## Monorepo layout

```
MuseLab/
├── apps/
│   └── designer/           # @muselab/designer — React app + Electron shell
│       ├── src/            # Designer + Player views, core model, cito compile
│       ├── electron/       # Main process, preload, IPC
│       ├── public/         # Static assets, cito-wasm bundle
│       ├── wasm/cito/      # Browser WASM cito wrapper
│       └── muselab.*.schema.json
├── web/
│   └── muselab/            # @muselab/web-muselab — static landing page
├── packages/
│   └── shared/             # @muselab/shared — shared TS modules
├── infra/
│   └── muselab-site/       # @muselab/site — Cloudflare Worker + deploy bundle
├── scaffolds/
│   └── unity/
│       └── MuseLab/        # Unity 6 player scaffold
├── third_party/cito/       # Marco012/cito (git submodule)
├── tools/cito/             # Built native transpiler output (gitignored)
├── scripts/                # bump-version.sh
├── package.json            # Root workspace scripts (turbo)
├── pnpm-workspace.yaml
└── turbo.json
```

## Implementation notes

- **Text templates:** HTML with embedded **Cito** in `{{ }}` blocks; structural `{{#if}}…{{/if}}`. Runtime API: `rt.GetString/GetBool/GetInt`, `rt.SetString/SetBool/SetInt`, `rt.Emit`, `rt.Call`, `rt.PlaySound`, and `Format.*` markup. Templates compile to `.ci` and transpile to JavaScript via [cito](https://github.com/Marco012/cito) in the Electron main process. See [docs/cito-templates.md](docs/cito-templates.md).
- **Assets:** File picker in Electron; asset protocol for resolving paths in the player.
- **Auto layout:** New or moved nodes are nudged so they don't overlap.
- **Unity export:** Designer exports a C# zip consumed by the Unity scaffold via `StreamingAssets/MuseLabExport/`.
