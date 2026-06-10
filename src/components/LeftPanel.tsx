import { useEffect, useState, type ComponentType } from "react";
import { AssetsPanel } from "./AssetsPanel";
import { ProjectPanel } from "./ProjectPanel";
import { ModulesPanel } from "./ModulesPanel";
import {
  AssetsTabIcon,
  ModulesTabIcon,
  ProjectTabIcon,
} from "./LeftPanelTabIcons";
import { useHorizontalResize } from "@/hooks/useHorizontalResize";

type LeftPanelTab = "project" | "assets" | "modules";

const LEFT_PANEL_TABS: ReadonlyArray<{
  id: LeftPanelTab;
  label: string;
  Icon: typeof ProjectTabIcon;
  Panel: ComponentType;
}> = [
  { id: "project", label: "Project", Icon: ProjectTabIcon, Panel: ProjectPanel },
  { id: "assets", label: "Assets", Icon: AssetsTabIcon, Panel: AssetsPanel },
  { id: "modules", label: "Modules", Icon: ModulesTabIcon, Panel: ModulesPanel },
];

const LEFT_PANEL_WIDTH_KEY = "muselab-left-panel-width";
const LEFT_PANEL_COLLAPSED_KEY = "muselab-left-panel-collapsed";
const DEFAULT_LEFT_PANEL_WIDTH = 240;
const MIN_LEFT_PANEL_WIDTH = 160;
const MAX_LEFT_PANEL_WIDTH = 480;
const COLLAPSED_LEFT_PANEL_WIDTH = 44;

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(LEFT_PANEL_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function LeftPanelCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={collapsed ? "M5 3.5 8.5 7 5 10.5" : "M9 3.5 5.5 7 9 10.5"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LeftPanel() {
  const [tab, setTab] = useState<LeftPanelTab>("project");
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const { width, isResizing, onResizePointerDown } = useHorizontalResize({
    initialWidth: DEFAULT_LEFT_PANEL_WIDTH,
    minWidth: MIN_LEFT_PANEL_WIDTH,
    maxWidth: MAX_LEFT_PANEL_WIDTH,
    storageKey: LEFT_PANEL_WIDTH_KEY,
  });

  useEffect(() => {
    try {
      localStorage.setItem(LEFT_PANEL_COLLAPSED_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const activeTab = LEFT_PANEL_TABS.find((entry) => entry.id === tab) ?? LEFT_PANEL_TABS[0];
  const shellWidth = collapsed ? COLLAPSED_LEFT_PANEL_WIDTH : width;

  const selectTab = (id: LeftPanelTab) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setTab(id);
  };

  return (
    <div
      className={`app-side-panel-shell${collapsed ? " is-collapsed" : ""}`}
      style={{ width: shellWidth }}
    >
      <aside className="app-side-panel">
        <div className="app-side-panel-header">
          <button
            type="button"
            className="app-icon-button app-side-panel-collapse-toggle"
            aria-label={collapsed ? "Expand left panel" : "Collapse left panel"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            onClick={() => setCollapsed((open) => !open)}
          >
            <LeftPanelCollapseIcon collapsed={collapsed} />
          </button>
        </div>
        <div className="app-side-panel-tabs" role="tablist" aria-label="Left panel">
          {LEFT_PANEL_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`left-panel-tab-${id}`}
              aria-selected={!collapsed && tab === id}
              aria-controls={collapsed ? undefined : `left-panel-panel-${id}`}
              aria-label={label}
              title={label}
              className={`app-side-panel-tab${!collapsed && tab === id ? " is-active" : ""}`}
              onClick={() => selectTab(id)}
            >
              <Icon />
            </button>
          ))}
        </div>
        {!collapsed && (
          <>
            <div className="app-side-panel-title">{activeTab.label}</div>
            <div className="app-side-panel-content">
              {LEFT_PANEL_TABS.map(({ id, Panel }) =>
                tab === id ? (
                  <div
                    key={id}
                    role="tabpanel"
                    id={`left-panel-panel-${id}`}
                    aria-labelledby={`left-panel-tab-${id}`}
                  >
                    <Panel />
                  </div>
                ) : null
              )}
            </div>
          </>
        )}
      </aside>
      {!collapsed && (
        <div
          className={`app-side-panel-resize-handle${isResizing ? " is-active" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left panel"
          onPointerDown={onResizePointerDown}
        />
      )}
    </div>
  );
}
