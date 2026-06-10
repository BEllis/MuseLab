import type { CSSProperties, ReactNode } from "react";

export function InspectorPanelId({ id }: { id: string }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: "11px", color: "var(--app-text-subtle)" }}>
      ID: <code style={{ fontSize: "11px" }}>{id}</code>
    </p>
  );
}

export function InspectorPanelDetails({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
      {children}
    </div>
  );
}

export const inspectorSubtextStyle: CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "var(--app-text-muted)",
};
