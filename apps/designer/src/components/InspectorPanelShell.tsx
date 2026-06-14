import { createContext, useContext, type ReactNode } from "react";
import { useHorizontalResize } from "@/hooks/useHorizontalResize";

const RIGHT_PANEL_WIDTH_KEY = "muselab-right-panel-width";
const DEFAULT_RIGHT_PANEL_WIDTH = 320;
const MIN_RIGHT_PANEL_WIDTH = 160;
const MAX_RIGHT_PANEL_WIDTH = 480;

type InspectorPanelLayoutContextValue = {
  expanded: boolean;
  onToggleExpanded: () => void;
};

const InspectorPanelLayoutContext = createContext<InspectorPanelLayoutContextValue | null>(null);

export function useInspectorPanelLayout(): InspectorPanelLayoutContextValue {
  const value = useContext(InspectorPanelLayoutContext);
  if (!value) {
    throw new Error("useInspectorPanelLayout must be used within InspectorPanelShell");
  }
  return value;
}

type InspectorPanelShellProps = {
  children: ReactNode;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function InspectorPanelShell({
  children,
  expanded,
  onToggleExpanded,
}: InspectorPanelShellProps) {
  const { width, isResizing, onResizePointerDown } = useHorizontalResize({
    initialWidth: DEFAULT_RIGHT_PANEL_WIDTH,
    minWidth: MIN_RIGHT_PANEL_WIDTH,
    maxWidth: MAX_RIGHT_PANEL_WIDTH,
    storageKey: RIGHT_PANEL_WIDTH_KEY,
    resizeEdge: "left",
  });

  return (
    <InspectorPanelLayoutContext.Provider value={{ expanded, onToggleExpanded }}>
      <div
        className={`app-side-panel-shell app-inspector-panel-shell${expanded ? " is-expanded" : ""}`}
        style={expanded ? { flex: 1, minWidth: 0 } : { width }}
      >
        {!expanded && (
          <div
            className={`app-side-panel-resize-handle is-start-edge${isResizing ? " is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector panel"
            onPointerDown={onResizePointerDown}
          />
        )}
        <aside className="app-inspector-panel">{children}</aside>
      </div>
    </InspectorPanelLayoutContext.Provider>
  );
}
