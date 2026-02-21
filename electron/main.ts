import { app, BrowserWindow, ipcMain, dialog, protocol, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSET_PROTOCOL = "asset";

protocol.registerSchemesAsPrivileged([
  { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  protocol.registerFileProtocol(ASSET_PROTOCOL, (request, callback) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const filePath = process.platform === "win32"
        ? path.win32.normalize(pathname.replace(/^\//, "").replace(/\//g, "\\"))
        : path.normalize(pathname);
      if (!path.isAbsolute(filePath)) {
        callback({ error: -2 });
        return;
      }
      callback({ path: filePath });
    } catch {
      callback({ error: -2 });
    }
  });

  ipcMain.handle("open-file-dialog", async (_, options: { type: "backdrop" | "actor" | "sound"; multiple?: boolean }) => {
    const filters =
      options.type === "sound"
        ? [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a"] }]
        : [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }];
    const result = await dialog.showOpenDialog({
      properties: options.multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters,
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("resolve-asset-url", (_, filePath: string) => {
    const pathname = path.posix.join("/", path.normalize(filePath).replace(/\\/g, "/"));
    return `${ASSET_PROTOCOL}://localhost${encodeURI(pathname)}`;
  });

  const projectFilters = [{ name: "MuseLab project", extensions: ["json"] }];

  ipcMain.handle("show-save-dialog", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, { filters: projectFilters });
    return result.canceled ? null : result.filePath ?? null;
  });

  ipcMain.handle("write-project-file", async (_, filePath: string, json: string) => {
    await writeFile(filePath, json, "utf8");
  });

  ipcMain.handle("set-window-size", (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      win.setSize(Math.round(width), Math.round(height));
    }
  });

  ipcMain.handle("show-before-new-dialog", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return 2;
    const result = await dialog.showMessageBox(win, {
      type: "question",
      title: "Unsaved changes",
      message: "Save changes before creating a new project?",
      buttons: ["Save", "Don't Save", "Cancel"],
      cancelId: 2,
      defaultId: 0,
    });
    return result.response as 0 | 1 | 2;
  });

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("request-new");
          },
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("request-save");
          },
        },
        {
          label: "Load",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const result = await dialog.showOpenDialog(win, {
              properties: ["openFile"],
              filters: projectFilters,
            });
            if (result.canceled || result.filePaths.length === 0) return;
            const json = await readFile(result.filePaths[0], "utf8");
            win.webContents.send("load-project-data", json);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [{ role: "about" }],
    },
  ]);
  Menu.setApplicationMenu(menu);

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
