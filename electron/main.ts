import { app, BrowserWindow, ipcMain, dialog, protocol, Menu, nativeTheme } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { loadUserSettings, resolveStartupTheme, saveUserSettings, getPlayerLocale, setPlayerLocale, type AppTheme } from "./userSettings";
import { readAutosaveFile, writeAutosaveFile } from "./autosave";
import { transpileCiToJs } from "./citoTranspile";
import { handleAssetProtocolRequest, readAssetFile } from "./assetProtocol";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_NAME = "MuseLab";
const APP_WINDOW_TITLE = `${APP_NAME} – Visual Novel Designer`;
const IS_LINUX = process.platform === "linux";

app.setName(APP_NAME);
if (IS_LINUX) {
  app.commandLine.appendSwitch("class", APP_NAME);
}

const ASSET_PROTOCOL = "asset";
const projectFilters = [
  { name: "MuseLab project", extensions: ["mlvn"] },
  { name: "Legacy JSON project", extensions: ["json"] },
];
const THEME_CHROME: Record<AppTheme, { background: string; menubar: string; symbol: string }> = {
  light: { background: "#ffffff", menubar: "#f0f0f0", symbol: "#1a1a1a" },
  dark: { background: "#121212", menubar: "#1e1e1e", symbol: "#e8e8e8" },
};

let currentTheme: AppTheme = "light";
let undoRedoMenuState = { canUndo: false, canRedo: false };

function getTitleBarOverlay(theme: AppTheme) {
  const colors = THEME_CHROME[theme];
  return {
    color: colors.menubar,
    symbolColor: colors.symbol,
    height: 28,
  };
}

function applyThemeToWindow(win: BrowserWindow, theme: AppTheme): void {
  win.setBackgroundColor(THEME_CHROME[theme].background);
  if (IS_LINUX) {
    win.setTitleBarOverlay(getTitleBarOverlay(theme));
  }
}

function applyNativeTheme(theme: AppTheme): void {
  nativeTheme.themeSource = theme;
  for (const win of BrowserWindow.getAllWindows()) {
    applyThemeToWindow(win, theme);
  }
}

function setAppTheme(theme: AppTheme, source: "menu" | "renderer"): void {
  if (theme !== "light" && theme !== "dark") return;
  currentTheme = theme;
  applyNativeTheme(theme);
  buildApplicationMenu();
  void saveUserSettings({ theme });
  if (source === "menu") {
    sendThemeToFocusedWindow(theme);
  }
}

function sendToFocusedWindow(channel: string): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send(channel);
}

function sendThemeToFocusedWindow(theme: AppTheme): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send("set-theme", theme);
}

function buildApplicationMenu(): void {
  if (IS_LINUX) {
    Menu.setApplicationMenu(null);
    return;
  }

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
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("request-load");
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          enabled: undoRedoMenuState.canUndo,
          click: () => sendToFocusedWindow("request-undo"),
        },
        {
          label: "Redo",
          accelerator: process.platform === "darwin" ? "Shift+CmdOrCtrl+Z" : "Ctrl+Y",
          enabled: undoRedoMenuState.canRedo,
          click: () => sendToFocusedWindow("request-redo"),
        },
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
        {
          label: "Theme",
          submenu: [
            {
              label: "Light Mode",
              type: "radio",
              checked: currentTheme === "light",
              click: () => setAppTheme("light", "menu"),
            },
            {
              label: "Dark Mode",
              type: "radio",
              checked: currentTheme === "dark",
              click: () => setAppTheme("dark", "menu"),
            },
          ],
        },
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
      submenu: [
        {
          label: "About MuseLab",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send("show-about");
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_PROTOCOL,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, "../build/icon.png"),
    path.join(process.resourcesPath, "icon.png"),
    path.join(app.getAppPath(), "build/icon.png"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  const iconPath = resolveAppIconPath();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: APP_WINDOW_TITLE,
    backgroundColor: THEME_CHROME[currentTheme].background,
    ...(IS_LINUX
      ? {
          titleBarStyle: "hidden",
          titleBarOverlay: getTitleBarOverlay(currentTheme),
        }
      : {}),
    ...(iconPath ? { icon: iconPath } : {}),
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

app.whenReady().then(async () => {
  currentTheme = await resolveStartupTheme();
  protocol.handle(ASSET_PROTOCOL, (request) => handleAssetProtocolRequest(request));

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

  ipcMain.handle("read-asset-file", async (_, filePath: string) => readAssetFile(filePath));

  ipcMain.handle("show-save-dialog", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, { filters: projectFilters });
    return result.canceled ? null : result.filePath ?? null;
  });

  ipcMain.handle("open-project-file", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: projectFilters,
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const data = await readFile(filePath);
    if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b) {
      return { type: "archive", data: new Uint8Array(data), path: filePath };
    }
    return { type: "json", data: data.toString("utf8"), path: filePath };
  });

  ipcMain.handle("write-project-file", async (_, filePath: string, data: Uint8Array) => {
    await writeFile(filePath, Buffer.from(data));
  });

  ipcMain.handle(
    "extract-archive-assets",
    async (
      _,
      cacheKey: string,
      entries: { relativePath: string; data: Uint8Array }[]
    ) => {
      const hash = createHash("sha256").update(cacheKey).digest("hex").slice(0, 16);
      const baseDir = path.join(tmpdir(), "muselab-projects", hash);

      for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.relativePath);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, Buffer.from(entry.data));
      }

      return baseDir;
    }
  );

  ipcMain.handle("set-window-size", (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      win.setSize(Math.round(width), Math.round(height));
    }
  });

  ipcMain.handle("show-before-new-dialog", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    const result = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Unsaved changes",
      message:
        "You have unsaved changes. Start a new project anyway? Your changes will be lost.",
      buttons: ["Create New Project", "Cancel"],
      cancelId: 1,
      defaultId: 1,
    });
    return result.response === 0;
  });

  ipcMain.handle("get-user-settings", () => loadUserSettings());
  ipcMain.handle("read-autosave", () => readAutosaveFile());
  ipcMain.handle("write-autosave", async (_, payload: string) => {
    if (typeof payload !== "string") {
      throw new Error("write-autosave requires a JSON string payload");
    }
    await writeAutosaveFile(payload);
  });
  ipcMain.handle("get-player-locale", (_, projectKey: string) => getPlayerLocale(projectKey));
  ipcMain.handle("set-player-locale", (_, projectKey: string, locale: string) =>
    setPlayerLocale(projectKey, locale)
  );

  ipcMain.handle("cito:transpile", async (_, request: { ciSource: string }) => {
    if (!request?.ciSource || typeof request.ciSource !== "string") {
      throw new Error("cito:transpile requires ciSource string");
    }
    const js = await transpileCiToJs(request.ciSource);
    return { js };
  });

  ipcMain.on("sync-theme", (_, theme: AppTheme) => {
    setAppTheme(theme, "renderer");
  });

  ipcMain.on("sync-undo-redo-state", (_, state: { canUndo?: boolean; canRedo?: boolean }) => {
    undoRedoMenuState = {
      canUndo: Boolean(state?.canUndo),
      canRedo: Boolean(state?.canRedo),
    };
    buildApplicationMenu();
  });

  applyNativeTheme(currentTheme);
  buildApplicationMenu();

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
