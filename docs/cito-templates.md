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
| `{{ rt.PlaySound("asset-id") }}` | Play a sound asset immediately |
| `{{ rt.PlaySoundClip("asset-id", 0, -1, -1) }}` | Queue a sound clip when the prompt reaches this point |
| `{{ prompter.Wait(500) }}` | Pause 500 ms before continuing the prompt |
| `{{ prompter.RevealCharsBegin(-1) }}` … `{{ prompter.RevealEnd() }}` | Reveal following text character-by-character |
| `{{ prompter.RevealWordsBegin(-1) }}` … `{{ prompter.RevealEnd() }}` | Reveal following text word-by-word |
| `{{ prompter.RevealCharsOverTimeBegin(2000) }}` … `{{ prompter.RevealEnd() }}` | Reveal text over 2 seconds (by character) |
| `{{ prompter.RevealWordsOverTimeBegin(2000) }}` … `{{ prompter.RevealEnd() }}` | Reveal text over 2 seconds (by word) |
| `{{#if rt.GetBool("metMaya")}}…{{/if}}` | Conditional block |
| `{{ Format.BoldStart() }}` / `{{ Format.BoldEnd() }}` | Bold markup |
| `{{ Format.ItalicStart() }}` / `{{ Format.ItalicEnd() }}` | Italic markup |
| `{{ Format.ColorStart("#ff0000") }}` / `{{ Format.ColorEnd() }}` | Colored span |
| `{{ Format.ShakeCharsStart() }}` … `{{ Format.ShakeCharsEnd() }}` | Per-character shake (wraps following text) |
| `{{ Format.ShakePhraseStart() }}` … `{{ Format.ShakePhraseEnd() }}` | Phrase shake (wraps following text) |
| `{{ Format.ShakeCharsText("…") }}` | Insert text with per-character shake |
| `{{ Format.ShakePhraseText("…") }}` | Insert text with phrase shake |

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
| `PlaySound(assetId)` | Start sound immediately when the template is evaluated |
| `PlaySoundTrim(assetId, startTime, endTime)` | Play a trimmed sound segment immediately |
| `PlaySoundClip(assetId, delaySeconds, startTime, endTime)` | Queue a sound clip at this point in the prompt stream |
| `PlaySoundClipByPath(groupPath, assetName, delaySeconds, startTime, endTime)` | Queue a sound clip resolved from an Assets folder path |

Sentinel values for clip playback:

- `delaySeconds`: `0` = play when the player reaches this instruction; `> 0` = extra wait after that point
- `startTime` / `endTime`: `-1` = play the full clip (no trim)

## Prompt timing API (`prompter`)

These instructions run **in order** during player playback. Designer thumbnails and scene previews still show the full rendered text instantly.

| Method | Description |
|--------|-------------|
| `Wait(milliseconds)` | Pause before continuing |
| `RevealCharsBegin(charsPerSecond)` | Reveal following text by character; `-1` uses 40 cps |
| `RevealWordsBegin(wordsPerSecond)` | Reveal following text by word; `-1` uses 12 wps |
| `RevealCharsOverTimeBegin(durationMs)` | Reveal the block from Begin to End over `durationMs` (by character) |
| `RevealWordsOverTimeBegin(durationMs)` | Reveal the block from Begin to End over `durationMs` (by word) |
| `RevealEnd()` | End a reveal block; following text appears instantly |

Example:

```cito
{{ prompter.RevealCharsBegin(-1) }}
The lights flicker.
{{ rt.PlaySoundClip("sfx-buzz", 0, -1, -1) }}
Something hums nearby.
{{ prompter.RevealEnd() }}
{{ prompter.Wait(800) }}
Everything goes still.
```

Click the dialogue box during playback to skip to the end and fire any remaining queued sounds.

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
2. Initialize cito submodule: `git submodule update --init --recursive`
3. Build the transpiler: `npm run build:cito`

Cito transpilation runs in the **Electron main process**. Browser-only `npm run dev` cannot evaluate templates; use `npm run electron:dev`.

## Architecture

- [`src/core/cito/compileTemplate.ts`](../src/core/cito/compileTemplate.ts) — parse HTML + `{{ }}` → `.ci` `Render` method
- [`src/core/cito/compileCondition.ts`](../src/core/cito/compileCondition.ts) — wrap edge conditions in `Eval`
- [`electron/citoTranspile.ts`](../electron/citoTranspile.ts) — invoke cito subprocess
- [`src/core/cito/runtimeBridge.ts`](../src/core/cito/runtimeBridge.ts) — TS bridge for state and side effects
- [`src/cito/MuseLabRuntime.ci`](../src/cito/MuseLabRuntime.ci) — Cito API stub for compilation
- [`src/cito/MuseLabPromptRenderer.ci`](../src/cito/MuseLabPromptRenderer.ci) — prompt renderer + timing stubs
- [`src/cito/Format.ci`](../src/cito/Format.ci) — markup directives
- [`src/core/prompt/promptInstructions.ts`](../src/core/prompt/promptInstructions.ts) — sequential prompt instruction recorder
- [`src/components/PromptInstructionExecutor.tsx`](../src/components/PromptInstructionExecutor.tsx) — player-side instruction runner

Future export can run `cito -o out.py template.ci` (or other targets) on the same stored Cito source.
