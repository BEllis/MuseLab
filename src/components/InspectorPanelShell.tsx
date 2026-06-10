import type { ReactNode } from "react";
import { useHorizontalResize } from "@/hooks/useHorizontalResize";

const RIGHT_PANEL_WIDTH_KEY = "muselab-right-panel-width";
const DEFAULT_RIGHT_PANEL_WIDTH = 320;
const MIN_RIGHT_PANEL_WIDTH = 160;
const MAX_RIGHT_PANEL_WIDTH = 480;

export function InspectorPanelShell({ children }: { children: ReactNode }) {
  const { width, isResizing, onResizePointerDown } = useHorizontalResize({
    initialWidth: DEFAULT_RIGHT_PANEL_WIDTH,
    minWidth: MIN_RIGHT_PANEL_WIDTH,
    maxWidth: MAX_RIGHT_PANEL_WIDTH,
    storageKey: RIGHT_PANEL_WIDTH_KEY,
    resizeEdge: "left",
  });

  return (
    <div className="app-side-panel-shell app-inspector-panel-shell" style={{ width }}>
      <div
        className={`app-side-panel-resize-handle is-start-edge${isResizing ? " is-active" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector panel"
        onPointerDown={onResizePointerDown}
      />
      <aside className="app-inspector-panel">{children}</aside>
    </div>
  );
}
