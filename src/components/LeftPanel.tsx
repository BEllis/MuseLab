import { useState, type ComponentType } from "react";
import { AssetsPanel } from "./AssetsPanel";
import { ProjectPanel } from "./ProjectPanel";
import { ModulesPanel } from "./ModulesPanel";
import { StoriesPanel } from "./StoriesPanel";
import {
  AssetsTabIcon,
  ModulesTabIcon,
  ProjectTabIcon,
  StoriesTabIcon,
} from "./LeftPanelTabIcons";
import { useHorizontalResize } from "@/hooks/useHorizontalResize";

type LeftPanelTab = "project" | "stories" | "assets" | "modules";

const LEFT_PANEL_TABS: ReadonlyArray<{
  id: LeftPanelTab;
  label: string;
  Icon: typeof ProjectTabIcon;
  Panel: ComponentType;
}> = [
  { id: "project", label: "Project", Icon: ProjectTabIcon, Panel: ProjectPanel },
  { id: "stories", label: "Stories", Icon: StoriesTabIcon, Panel: StoriesPanel },
  { id: "assets", label: "Assets", Icon: AssetsTabIcon, Panel: AssetsPanel },
  { id: "modules", label: "Modules", Icon: ModulesTabIcon, Panel: ModulesPanel },
];

const LEFT_PANEL_WIDTH_KEY = "muselab-left-panel-width";
const DEFAULT_LEFT_PANEL_WIDTH = 240;
const MIN_LEFT_PANEL_WIDTH = 160;
const MAX_LEFT_PANEL_WIDTH = 480;

export function LeftPanel() {
  const [tab, setTab] = useState<LeftPanelTab>("project");
  const { width, isResizing, onResizePointerDown } = useHorizontalResize({
    initialWidth: DEFAULT_LEFT_PANEL_WIDTH,
    minWidth: MIN_LEFT_PANEL_WIDTH,
    maxWidth: MAX_LEFT_PANEL_WIDTH,
    storageKey: LEFT_PANEL_WIDTH_KEY,
  });

  const activeTab = LEFT_PANEL_TABS.find((entry) => entry.id === tab) ?? LEFT_PANEL_TABS[0];

  return (
    <div className="app-side-panel-shell" style={{ width }}>
      <aside className="app-side-panel">
        <div className="app-side-panel-tabs" role="tablist" aria-label="Left panel">
          {LEFT_PANEL_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`left-panel-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`left-panel-panel-${id}`}
              aria-label={label}
              title={label}
              className={`app-side-panel-tab${tab === id ? " is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon />
            </button>
          ))}
        </div>
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
      </aside>
      <div
        className={`app-side-panel-resize-handle${isResizing ? " is-active" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize left panel"
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}
