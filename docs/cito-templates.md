# MuseLab text templates

Scene dialogue, speaker names, and player choice visibility are driven by **text templates**. MuseLab embeds the [Ć programming language](https://github.com/Marco012/cito) (transpiled with **cito**) inside those templates. You write **Razor-style `@` syntax** with Cito expressions; at runtime MuseLab compiles them to `.ci`, transpiles to JavaScript, and executes the result against typed built-in APIs.

Templates appear in:

- **Scene prompt text** — the main dialogue / narration box
- **Speaker fields** — the name shown above dialogue (supports the same syntax)
- **Edge conditions** — bare Cito expressions that hide or show player choices
- **Story wrap templates** — optional prefix/suffix text wrapped around every scene prompt or speaker in a story

---

## Razor syntax

The `@` character switches from plain text into code. There are four forms:

| Form | Example | Purpose |
|------|---------|---------|
| **Output expression** | `@rt.GetString("name")` | Evaluate and insert the result into the rendered output |
| **Parenthesized output** | `@(rt.GetInt("a") + rt.GetInt("b"))` | Same as above, for complex expressions |
| **Code block** | `@{ rt.SetBool("seen", true); }` | Run one or more statements with **no visible output** |
| **Conditional block** | `@if (rt.GetBool("flag")) { … }` | Include the body only when the condition is true |

Additional rules:

| Syntax | Meaning |
|--------|---------|
| `@@` | Literal `@` in output (use for email addresses: `user@@example.com`) |
| Line breaks | Single newlines become line breaks in the player; blank lines add extra vertical space |
| `<` and `>` | **Not HTML.** Angle brackets in template text and expression results are escaped and shown literally |

Templates are **plain text** with `@` code regions. Do not write HTML tags such as `<p>` or `<b>` — they appear verbatim to the player. Use **`Format.*`** helpers for bold, italic, color, shake, and fonts.

### Output vs side effects

**Output expressions** (`@expr` and `@(expr)`) may only call APIs that **return a value to display**:

- `rt.GetString`, `rt.GetBool`, `rt.GetInt`, `rt.Call`
- `Format.*` / `format.*` markup helpers
- Custom project modules (by their binding name)

**Side-effect APIs** must use a **code block** `@{ …; }`:

- `rt.SetString`, `rt.SetBool`, `rt.SetInt`, `rt.Emit`
- `rt.PlaySound`, `rt.PlaySoundTrim`, `rt.PlaySoundClip`, `rt.PlaySoundClipByPath`
- All `prompter.*` timing and playback controls

Using a side-effect call as bare `@` output is a compile error.

### Common mistakes

| Problem | Fix |
|---------|-----|
| `user@host.com` parsed as code | Write `user@@host.com` |
| `@prompter.WaitInMs(500)` | Use `@{ prompter.WaitInMs(500); }` |
| `@rt.SetBool("x", true)` | Use `@{ rt.SetBool("x", true); }` |

---

## Built-in APIs

MuseLab ships three built-in modules. In templates they are bound as:

| Binding | Alias | Role |
|---------|-------|------|
| `rt` | — | Read/write story state, events, sounds |
| `format` | `Format` | Rich text markup (bold, color, shake, fonts) |
| `prompter` | — | Timed dialogue playback during player mode |

`Format.BoldStart()` and `format.BoldStart()` are equivalent.

### Runtime (`rt`)

Story state is keyed by string. Keys are shared across scenes in the active story.

| Method | Returns | Description |
|--------|---------|-------------|
| `GetString(key)` | `string` | Read a string from runtime state |
| `GetBool(key)` | `bool` | Read a boolean |
| `GetInt(key)` | `int` | Read an integer |
| `SetString(key, value)` | — | Write a string (use in `@{ … }`) |
| `SetBool(key, value)` | — | Write a boolean |
| `SetInt(key, value)` | — | Write an integer |
| `Emit(eventName)` | — | Fire a named event to the player host |
| `Call(name)` | `string` | Call a registered host handler; insert its return value |
| `PlaySound(assetId)` | — | Play a sound **immediately** when the template is evaluated |
| `PlaySoundTrim(assetId, startTime, endTime)` | — | Play a trimmed segment immediately |
| `PlaySoundClip(assetId, delaySeconds, startTime, endTime)` | — | Queue a sound at a point in the prompt stream |
| `PlaySoundClipByPath(groupPath, assetName, delaySeconds, startTime, endTime)` | — | Queue a sound resolved from an Assets folder path |

**Sound clip sentinels:**

- `delaySeconds`: `0` = play when the player reaches this instruction; `> 0` = extra wait after that point
- `startTime` / `endTime`: `-1` = full clip (no trim)

Use `PlaySound` / `PlaySoundTrim` for instant feedback (e.g. UI clicks). Use `PlaySoundClip` when the sound should sync with typed dialogue.

### Format (`Format` / `format`)

Markup helpers apply styling to following text (or inline text for `*Text` variants). Pair **Start/End** calls around the text they affect. The renderer emits safe markup internally; authors do not write HTML tags directly.

| Method | Description |
|--------|-------------|
| `BoldStart()` / `BoldEnd()` | Bold span |
| `ItalicStart()` / `ItalicEnd()` | Italic span |
| `ColorStart(colorHex)` / `ColorEnd()` | Colored span, e.g. `#ff0000` |
| `ShakeCharsStart()` / `ShakeCharsEnd()` | Per-character shake on following text |
| `ShakePhraseStart()` / `ShakePhraseEnd()` | Whole-phrase shake on following text |
| `ShakeCharsText(text)` | Insert text with inline per-character shake |
| `ShakePhraseText(text)` | Insert text with inline phrase shake |
| `FontStyleBegin(fontAssetId, fontSizePx, fontWeight)` | Font from a font asset; pass `-1` to omit size or weight |
| `FontStyleByPathBegin(groupPath, assetName, fontSizePx, fontWeight)` | Font from Assets folder path + name |
| `FontStyleEnd()` | Close font span (also closes nested size/weight spans) |
| `FontSizeBegin(fontSizePx)` | Nested size span (1–200 px), inside `FontStyleBegin` |
| `FontSizeEnd()` | Close size span |
| `FontWeightBegin(fontWeight)` | Nested weight span (100–900, step 100), inside `FontStyleBegin` |
| `FontWeightEnd()` | Close weight span |

### Prompter (`prompter`)

These run **in order** during player playback. The designer preview shows full text instantly; the player reveals it step by step.

| Method | Description |
|--------|-------------|
| `WaitInMs(milliseconds)` | Pause before continuing |
| `RevealCharsBegin(charsPerSecond)` | Reveal following text character-by-character; `-1` = 40 cps |
| `RevealWordsBegin(wordsPerSecond)` | Reveal following text word-by-word; `-1` = 12 wps |
| `RevealCharsOverTimeBegin(durationMs)` | Reveal until `RevealEnd()` over `durationMs` (by character) |
| `RevealWordsOverTimeBegin(durationMs)` | Reveal until `RevealEnd()` over `durationMs` (by word) |
| `RevealEnd()` | End a reveal block; following text appears instantly |
| `WaitForContinue()` | Pause and show a continue hint until the player clicks |
| `UpdateSpeaker(template)` | Replace the speaker name; `template` is rendered like a speaker field |
| `Reset()` | Clear all prompt text and reset the speaker |
| `Clear()` | Clear prompt text but keep the current speaker |

Click the dialogue box during playback to skip to the end and fire any remaining queued sounds.

---

## Edge conditions

Edge **condition** fields use **bare Cito** — no `@` prefix. The expression must evaluate to a boolean:

```
rt.GetBool("hasKey")
rt.GetInt("trust") >= 3
rt.GetString("route") == "left"
```

Leave empty to always show the choice.

---

## Custom modules

Projects can define additional Cito modules in the **Modules** panel. Each module has a **binding name** (e.g. `gameSave`) that becomes a valid root in output expressions:

```
@gameSave.LastCheckpoint()
```

Custom module methods follow the same rules: returning values use `@` output; void side effects use `@{ … }`.

---

## Examples

### Basic dialogue with state

```
Hello, @rt.GetString("playerName")!
You have @rt.GetInt("gold") gold.
```

Set state when the scene is first evaluated:

```
@{ rt.SetBool("visitedShop", true); }
Welcome back to the market.
```

### Conditional lines

Use separate `@if` blocks for mutually exclusive branches:

```
@if (rt.GetBool("metMaya")) {
Maya smiles when she sees you.
}
@if (!rt.GetBool("metMaya")) {
A stranger watches from the corner.
}
```

### Rich formatting

```
@Format.ItalicStart()The door creaks open.@Format.ItalicEnd()

@Format.ColorStart("#e8a040")"You're late."@Format.ColorEnd()

@Format.BoldStart()RUN!@Format.BoldEnd()
```

### Timed reveal with synced sound

```
@{ prompter.RevealCharsBegin(-1); }
The lights flicker.
@{ rt.PlaySoundClip("sfx-buzz", 0, -1, -1); }
Something hums nearby.
@{ prompter.RevealEnd(); }
@{ prompter.WaitInMs(800); }
Everything goes still.
```

### Wait for the player to click

```
The path splits ahead.
@{ prompter.WaitForContinue(); }
You take a deep breath and step forward.
```

### Change speaker mid-scene

```
I found something.
@{ prompter.UpdateSpeaker("Maya"); }
Let me see that.
```

### Branching choice condition

On an edge from Scene A to Scene B, set **condition** to:

```
rt.GetInt("trust") >= 3
```

Only players with trust 3 or higher see that choice.

### Email address in plain text

```
Contact us at support@@muselab.dev for help.
```

### Complex expression with fallback

```
@(rt.GetString("playerName") != "" ? rt.GetString("playerName") : "Stranger"), she whispers.
```

### Showing literal angle brackets

If you need to display `<` or `>` in dialogue, write them normally — the renderer escapes them:

```
Use the command: ls -la > output.txt
```

The player sees: `Use the command: ls -la > output.txt` (with `>` rendered safely, not as HTML).

---

## Story wrap templates

Each story can define optional **prompt start/end** and **speaker start/end** templates. MuseLab wraps every scene prompt (or speaker) with these strings before compilation. Use them for repeated prefixes, suffixes, or shared formatting applied via `Format.*`.

Wrap templates use the same plain-text and Razor rules as scene text.

---

## Migrating from JavaScript templates

Older MuseLab projects used Handlebars-style `{{ … }}` syntax. That path has been removed.

| Old (JavaScript / Handlebars) | New (Cito / Razor) |
|-------------------------------|--------------------|
| `{{ state.name }}` | `@rt.GetString("name")` |
| `{{ state.flag }}` | `@rt.GetBool("flag")` |
| `{{ setState("x", true) }}` | `@{ rt.SetBool("x", true); }` |
| `{{ emit("evt") }}` | `@{ rt.Emit("evt"); }` |
| `{{#if state.metMaya}}` | `@if (rt.GetBool("metMaya")) {` |
| `{{bold_start()}}` | `@Format.BoldStart()` |
| `<p>…</p>` / `<b>…</b>` (legacy HTML) | Plain text + `@Format.BoldStart()` … `@Format.BoldEnd()` |
| `state.trust >= 3` (edge) | `rt.GetInt("trust") >= 3` |

---

## Developer setup

1. Install [.NET 6 SDK](https://dotnet.microsoft.com/download).
2. Initialize cito submodule: `git submodule update --init --recursive`
3. Build the transpiler: `npm run build:cito`

Cito transpilation runs in the **Electron main process**. Browser-only `npm run dev` cannot evaluate templates; use `npm run electron:dev`.

When editing the Razor grammar, run `npm run build:razor-grammar` to regenerate the Lezer parser.

---

## Architecture (for contributors)

- [`src/core/cito/museLabRazor.grammar`](../src/core/cito/museLabRazor.grammar) — Lezer grammar (shared by parser and CodeMirror)
- [`src/core/cito/parseRazorTemplate.ts`](../src/core/cito/parseRazorTemplate.ts) — Lezer tree walk → template segments
- [`src/core/cito/compileTemplate.ts`](../src/core/cito/compileTemplate.ts) — parse Razor → `.ci` `Render` method
- [`src/core/cito/compileCondition.ts`](../src/core/cito/compileCondition.ts) — wrap edge conditions in `Eval`
- [`src/core/modules/builtInModules.ts`](../src/core/modules/builtInModules.ts) — built-in API definitions
- [`electron/citoTranspile.ts`](../electron/citoTranspile.ts) — invoke cito subprocess
- [`src/core/template/engine.ts`](../src/core/template/engine.ts) — compile, transpile, execute, sanitize

Future export can run `cito -o out.py template.ci` (or other targets) on the same stored Cito source.
