# Cito templates in MuseLab

MuseLab embeds the [Ć programming language](https://github.com/Marco012/cito) (transpiled with **cito**) inside scene text templates and edge conditions. Authors write **Cito expressions** inside `{{ }}` blocks; at runtime MuseLab compiles them to `.ci`, transpiles to JavaScript via cito, and executes the result against a typed runtime bridge.

## Syntax overview

| Syntax | Meaning |
|--------|---------|
| `{{ rt.GetString("key") }}` | Insert a string from story state |
| `{{ rt.GetBool("flag") }}` | Insert a boolean value |
| `{{ rt.GetInt("count") }}` | Insert an integer value |
| `{{ rt.SetBool("flag", true) }}` | Set state (side effect; no visible output) |
| `{{ rt.SetString("name", "Ada") }}` | Set a string state value |
| `{{ rt.Emit("event") }}` | Fire a runtime event |
| `{{ rt.Call("handler") }}` | Call a registered handler; return value is inserted |
| `{{ rt.PlaySound("asset-id") }}` | Play a sound asset |
| `{{#if rt.GetBool("metMaya")}}…{{/if}}` | Conditional block |
| `{{ Format.BoldStart() }}` / `{{ Format.BoldEnd() }}` | Bold markup |
| `{{ Format.ItalicStart() }}` / `{{ Format.ItalicEnd() }}` | Italic markup |
| `{{ Format.ColorStart("#ff0000") }}` | Colored span |
| `{{ Format.ShakeCharsStart() }}` … `{{ Format.ShakeCharsEnd() }}` | Per-character shake |
| `{{ Format.ShakePhraseStart() }}` … `{{ Format.ShakePhraseEnd() }}` | Phrase shake |

Plain HTML (`<p>`, `<b>`, `<i>`, `<br>`, `<span>`, `<div>`) is allowed outside `{{ }}` blocks.

## Edge conditions

Edge `condition` fields are **bare Cito expressions** (no `{{ }}`), evaluated as booleans:

```
rt.GetBool("hasKey")
rt.GetInt("trust") >= 3
```

Leave empty to always show the choice.

## Runtime API (`rt`)

| Method | Description |
|--------|-------------|
| `GetString(key)` | Read string from `globalState` / runtime state |
| `GetBool(key)` | Read boolean |
| `GetInt(key)` | Read integer |
| `SetString(key, value)` | Write string |
| `SetBool(key, value)` | Write boolean |
| `SetInt(key, value)` | Write integer |
| `Emit(eventName)` | Callback hook |
| `Call(name)` | Invoke registered handler |
| `PlaySound(assetId)` | Start sound |
| `PlaySoundTrim(assetId, startTime, endTime)` | Play sound segment |

## Migrating from JavaScript templates

MuseLab previously evaluated raw JavaScript in templates. That path has been removed. Update projects manually:

| Old (JavaScript) | New (Cito) |
|------------------|------------|
| `{{ state.name }}` | `{{ rt.GetString("name") }}` |
| `{{ state.flag }}` | `{{ rt.GetBool("flag") }}` |
| `{{ setState("x", true) }}` | `{{ rt.SetBool("x", true) }}` |
| `{{ emit("evt") }}` | `{{ rt.Emit("evt") }}` |
| `{{#if state.metMaya}}` | `{{#if rt.GetBool("metMaya")}}` |
| `{{bold_start()}}` | `{{ Format.BoldStart() }}` |
| `state.trust >= 3` (edge) | `rt.GetInt("trust") >= 3` |

## Developer setup

1. Install [.NET 6 SDK](https://dotnet.microsoft.com/download).
2. Clone cito: `git clone https://github.com/Marco012/cito.git third_party/cito`
3. Build the transpiler: `npm run build:cito`

Cito transpilation runs in the **Electron main process**. Browser-only `npm run dev` cannot evaluate templates; use `npm run electron:dev`.

## Architecture

- [`src/core/cito/compileTemplate.ts`](../src/core/cito/compileTemplate.ts) — parse HTML + `{{ }}` → `.ci` `Render` method
- [`src/core/cito/compileCondition.ts`](../src/core/cito/compileCondition.ts) — wrap edge conditions in `Eval`
- [`electron/citoTranspile.ts`](../../electron/citoTranspile.ts) — invoke cito subprocess
- [`src/core/cito/runtimeBridge.ts`](../src/core/cito/runtimeBridge.ts) — TS bridge for state and side effects
- [`src/cito/MuseLabRuntime.ci`](../src/cito/MuseLabRuntime.ci) — Cito API stub for compilation
- [`src/cito/Format.ci`](../src/cito/Format.ci) — markup directives

Future export can run `cito -o out.py template.ci` (or other targets) on the same stored Cito source.
