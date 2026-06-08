<p align="center">
  <img src="docs/images/logo.png" alt="MuseLab logo" width="240">
</p>

<h1 align="center">MuseLab</h1>

<p align="center"><em>Visual Novel Designer</em></p>

A **visual novel / interactive story** designer and player. Build branching narratives in a node-based editor, then play them in the browser or on desktop.

## Screenshots

**Designer** – Node-based flow editor with scene nodes, assets, and text templates.

![Designer](docs/images/designer%20screenshot.png)

**Player** – Visual novel–style play view with dialogue box, actors, and choices.

![Player](docs/images/player%20screenshot.png)

## Features

- **Flow-based designer** – Place scene nodes on a canvas and connect them. Add option text and conditions so players see different choices depending on the story state.
- **Rich scenes** – Each node can have a backdrop image, one or more actor images, sounds (with start/stop, loop, trim), and a text template for dialogue and narrative.
- **Text templates** – Embed **Cito** (Ć language) in `{{ expression }}` blocks and `{{#if condition}}...{{/if}}` for conditionals. Use `rt.GetString("key")`, `rt.SetBool(...)`, `rt.Emit(...)`, `rt.Call(...)`, `rt.PlaySound(...)`, and `Format.*` markup helpers. See [docs/cito-templates.md](docs/cito-templates.md).
- **Assets** – Add backdrops, actors, and sounds from your computer. In the desktop app, use the file picker; in the browser, drag and drop.
- **Player** – Run your story from the designer (Play button). The player shows your scenes with dialogue, choices, and branching based on conditions and state.
- **Save and load** – In the desktop app, save your project as a `.mlvn` file (a zip archive) and load it later. Legacy plain `.json` projects can still be opened for migration. The app will prompt you to save before creating a new project or closing.

## How to Install

### Option 1: Run from source (web or desktop)

You need **Node.js 18 or newer** (and npm) installed. For template evaluation in the desktop app, you also need the **.NET 6 SDK** to build the bundled [cito](https://github.com/Marco012/cito) transpiler (`npm run build:cito`).

1. Clone the repository and go into the project folder:
   ```bash
   git clone https://github.com/BEllis/MuseLab.git
   cd MuseLab
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

You can then run MuseLab in the browser or as a desktop app (see [Getting Started](#getting-started)).

### Option 2: Use a built release (desktop)

If a desktop release is provided for your platform, download and run the installer or executable. No Node.js required.

## Getting Started

### Running the app

- **In the browser:** Run `npm run dev`, then open the URL shown (e.g. `http://localhost:5173`). Use the Designer to build your story and click **Play** to open the player.
- **Desktop app:** Run `npm run electron:dev`. Use **File → New / Save / Load** to manage project files.

### Creating your first story

1. **Open the Designer** – You start on the flow canvas. Click **Add scene** to create your first node.
2. **Add more scenes** – Create more nodes and connect them: drag from a node’s edge to another node to create a link.
3. **Edit a scene** – Select a node. In the side panel you can:
   - Set a **label** (for your reference).
   - Choose a **backdrop** image.
   - Add **actors** (character images). You can add multiple; they appear at the bottom of the play area.
   - Add **sounds** and set whether they start on load, loop, or trim to a time range.
   - Write the **text template** – your dialogue and narrative. Use Cito in `{{ }}` blocks, e.g. `{{ rt.GetString("name") }}`. See [docs/cito-templates.md](docs/cito-templates.md).
4. **Set up choices** – Select an edge (the line between two nodes). You can add **option text** (what the player sees, e.g. “Go left”) and an optional **Cito condition** (e.g. `rt.GetBool("hasKey")`) so the choice only appears when true.
5. **Add assets** – In the assets panel, add backdrops, actors, and sounds. Then assign them to your nodes.
6. **Play** – Click **Play** to open the player. The first node in the flow is the entry. Click through dialogue and choices to test your story.

### Player tips

- In the player header you can change **Resolution** to see how your story looks at different sizes. Use **Custom** to enter a specific width and height.
- When there’s only one path forward and no choice text, the dialogue box shows **Continue >>**; you can also click anywhere on the dialogue to advance.
- Use **Designer** in the player header to return to the editor.

### File menu (desktop app)

- **New** (Ctrl/Cmd+N) – Start a new project. You’ll be prompted to save first if there are unsaved changes.
- **Save** (Ctrl/Cmd+S) – Save the project as a `.mlvn` file.
- **Load** (Ctrl/Cmd+O) – Open a saved `.mlvn` project (or legacy `.json` for migration).
- **Quit** – Close the app.

## License

MIT License. Copyright (c) 2025 MuseLab. See [LICENSE](LICENSE) for the full text.

## For developers

If you want to contribute or work on the codebase, see [CONTRIBUTING.md](CONTRIBUTING.md) for the tech stack, project layout, and development commands.
