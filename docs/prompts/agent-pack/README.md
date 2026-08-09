# MuseLab MLVN Agent Documentation Pack

Give this entire folder (or the zip that contains it) to an AI agent that should author a complete MuseLab visual novel.

## Quick start for the agent

1. Read **`PROMPT.md`** end-to-end. That is the generation contract.
2. Keep these schemas open while writing JSON:
   - `schemas/muselab.bundle.schema.json` — required output shape
   - `schemas/muselab.story.schema.json` — `project` / `project.json`
   - `schemas/muselab.prompts.schema.json` — each locale prompts file
   - `schemas/muselab.mlvn.schema.json` — only if packing a `.mlvn` zip
3. Read **`cito-templates.md`** before writing dialogue `textTemplate` strings.
4. Validate the result:

```bash
pip install jsonschema referencing
python3 validate_mlvn.py path/to/bundle.json
# or
python3 validate_mlvn.py path/to/game.mlvn
```

Fix every `[ERROR]` and re-run until the validator reports OK.

## What to produce

- Preferred agent output: one **bundle JSON** object (`project` + `promptsByLocale`) at format version **6**.
- Optional packaging: a `.mlvn` zip (`muselab.json` + `project.json` + `prompts.<locale>.json` + optional `assets/`).

## Pack contents

| Path | Purpose |
|------|---------|
| `PROMPT.md` | Full authoring instructions (copy/paste agent prompt) |
| `cito-templates.md` | Razor/`@` template and Cito API reference |
| `schemas/*.schema.json` | JSON Schema source of truth |
| `validate_mlvn.py` | Schema + semantic validator with actionable errors |
| `README.md` | This file |

## Current format version

`6` (see `formatVersion` in generated JSON and `muselab.json`).
