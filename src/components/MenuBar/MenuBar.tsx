import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  loadProject,
  newProjectWithPrompt,
  saveProject,
} from "@/core/project/projectFileActions";
import {
  exportScriptWithScope,
  importScriptFile,
} from "@/core/script/scriptFileActions";
import { buildHelpSchemaMenuItems } from "@/core/schemas/helpSchemaMenuItems";
import {
  dispatchViewCommand,
  reloadPage,
  runProjectEditCommand,
  toggleFullscreen,
} from "@/core/view/viewCommands";
import { useProjectStore } from "@/store/projectStore";
import { useThemeStore } from "@/store/themeStore";
import { useAboutStore } from "@/store/aboutStore";
import { useExportStore } from "@/store/exportStore";
import logoUrl from "@/assets/logo.png";
import type { MenuDef, MenuItem } from "./menuTypes";
import "./MenuBar.css";

export const MENU_BAR_HEIGHT = 28;

type MenuPlatform = "mac" | "win";

function getMenuPlatform(): MenuPlatform {
  if (typeof navigator === "undefined") return "win";
  const platform = navigator.platform ?? "";
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS/.test(ua)) {
    return "mac";
  }
  return "win";
}

function isMac(): boolean {
  return getMenuPlatform() === "mac";
}

function modShortcut(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl+${key}`;
}

function MenuDropdownItems({
  items,
  onClose,
  onKeepOpen,
}: {
  items: MenuItem[];
  onClose: () => void;
  onKeepOpen: () => void;
}) {
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);

  return (
    <>
      {items.map((item, index) => {
        if (item.type === "separator") {
          return <div key={`sep-${index}`} role="separator" className="menubar-dropdown-separator" />;
        }
        if (item.type === "header") {
          return (
            <div key={`header-${item.label}`} className="menubar-dropdown-header" aria-hidden="true">
              {item.label}
            </div>
          );
        }
        if (item.submenu?.length) {
          return (
            <div
              key={item.label}
              className="menubar-submenu-wrap"
              onMouseEnter={() => {
                onKeepOpen();
                setOpenSubmenuIndex(index);
              }}
              onMouseLeave={() => setOpenSubmenuIndex(null)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={openSubmenuIndex === index}
                className="menubar-dropdown-item menubar-dropdown-item--submenu"
              >
                <span className="menubar-dropdown-check" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="menubar-dropdown-arrow" aria-hidden="true">
                  ▸
                </span>
              </button>
              {openSubmenuIndex === index && (
                <div role="menu" className="menubar-dropdown menubar-submenu">
                  <MenuDropdownItems items={item.submenu} onClose={onClose} onKeepOpen={onKeepOpen} />
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`menubar-dropdown-item${item.checked ? " is-checked" : ""}`}
            onClick={async () => {
              if (item.disabled || !item.action) return;
              onClose();
              await item.action();
            }}
          >
            <span className="menubar-dropdown-check" aria-hidden="true">
              {item.checked ? "✓" : ""}
            </span>
            <span>{item.label}</span>
            {item.shortcut && <span className="menubar-dropdown-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </>
  );
}

function MenuDropdown({
  menu,
  open,
  onOpen,
  onClose,
}: {
  menu: MenuDef;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="menubar-item">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={open}
        className={`menubar-label${open ? " is-open" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {menu.label}
      </button>
      {open && (
        <div role="menu" className="menubar-dropdown">
          <MenuDropdownItems items={menu.items} onClose={onClose} onKeepOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const location = useLocation();
  const isDesigner = location.pathname === "/";
  const platform = useMemo(() => getMenuPlatform(), []);
  const usesInAppChrome = Boolean(window.electronAPI?.usesInAppMenuBar);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const showAbout = useAboutStore((s) => s.show);
  const showExport = useExportStore((s) => s.show);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        { label: "New", shortcut: modShortcut("N"), action: () => newProjectWithPrompt() },
        { type: "separator" },
        { label: "Save", shortcut: modShortcut("S"), action: () => saveProject() },
        { label: "Load", shortcut: modShortcut("O"), action: () => loadProject() },
        { type: "separator" },
        { label: "Export…", action: () => showExport() },
        { type: "separator" },
        { label: "Export Script…", action: () => exportScriptWithScope() },
        { label: "Import Script…", action: () => importScriptFile() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: modShortcut("Z"), disabled: !canUndo, action: () => runProjectEditCommand("undo") },
        {
          label: "Redo",
          shortcut: isMac() ? "⇧⌘Z" : "Ctrl+Y",
          disabled: !canRedo,
          action: () => runProjectEditCommand("redo"),
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Reload", shortcut: modShortcut("R"), action: () => reloadPage() },
        { label: "Force Reload", shortcut: isMac() ? "⇧⌘R" : "Ctrl+Shift+R", action: () => reloadPage(true) },
        { type: "separator" },
        {
          label: "Reset Zoom",
          shortcut: modShortcut("0"),
          disabled: !isDesigner,
          action: () => dispatchViewCommand("zoomReset"),
        },
        {
          label: "Zoom In",
          shortcut: modShortcut("+"),
          disabled: !isDesigner,
          action: () => dispatchViewCommand("zoomIn"),
        },
        {
          label: "Zoom Out",
          shortcut: modShortcut("-"),
          disabled: !isDesigner,
          action: () => dispatchViewCommand("zoomOut"),
        },
        { type: "separator" },
        { label: "Light Mode", checked: theme === "light", action: () => setTheme("light") },
        { label: "Dark Mode", checked: theme === "dark", action: () => setTheme("dark") },
        { type: "separator" },
        { label: "Toggle Full Screen", action: () => toggleFullscreen() },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About MuseLab",
          action: () => showAbout(),
        },
        { type: "separator" },
        {
          label: "Schemas",
          submenu: buildHelpSchemaMenuItems(),
        },
      ],
    },
  ];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        runProjectEditCommand("undo");
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        runProjectEditCommand("redo");
      } else if (key === "n") {
        e.preventDefault();
        void newProjectWithPrompt();
      } else if (key === "s") {
        e.preventDefault();
        void saveProject();
      } else if (key === "o") {
        e.preventDefault();
        void loadProject();
      } else if (key === "r" && e.shiftKey) {
        e.preventDefault();
        reloadPage(true);
      } else if (key === "r") {
        e.preventDefault();
        reloadPage();
      } else if (isDesigner && key === "0") {
        e.preventDefault();
        dispatchViewCommand("zoomReset");
      } else if (isDesigner && (key === "=" || key === "+")) {
        e.preventDefault();
        dispatchViewCommand("zoomIn");
      } else if (isDesigner && key === "-") {
        e.preventDefault();
        dispatchViewCommand("zoomOut");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesigner]);

  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  return (
    <nav
      role="menubar"
      aria-label="Application menu"
      className="menubar"
      data-platform={platform}
      data-in-app-chrome={usesInAppChrome ? "true" : undefined}
      style={{ height: platform === "mac" ? 26 : 28 }}
    >
      <div className="menubar-brand" aria-hidden="true">
        <img src={logoUrl} alt="" className="menubar-logo" />
      </div>
      {menus.map((menu) => (
        <MenuDropdown
          key={menu.label}
          menu={menu}
          open={openMenu === menu.label}
          onOpen={() => setOpenMenu(menu.label)}
          onClose={closeMenu}
        />
      ))}
    </nav>
  );
}
