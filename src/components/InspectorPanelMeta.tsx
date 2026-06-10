import type { CSSProperties, ReactNode } from "react";
import { CloseButton } from "./CloseButton";
import { useInspectorPanelLayout } from "./InspectorPanelShell";

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

function InspectorExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {expanded ? (
        <>
          <path
            d="M5 2.5 2.5 5M9 2.5 11.5 5M5 11.5 2.5 9M9 11.5 11.5 9"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M2.5 5 5 2.5M9 2.5 11.5 5M2.5 9 5 11.5M11.5 9 9 11.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function InspectorExpandButton() {
  const { expanded, onToggleExpanded } = useInspectorPanelLayout();
  const label = expanded ? "Collapse panel" : "Expand panel";

  return (
    <button
      type="button"
      className="app-icon-button"
      aria-label={label}
      aria-pressed={expanded}
      title={label}
      onClick={onToggleExpanded}
      style={{
        width: "22px",
        height: "22px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        color: "var(--app-text-muted)",
      }}
    >
      <InspectorExpandIcon expanded={expanded} />
    </button>
  );
}

type InspectorPanelHeaderProps = {
  title: ReactNode;
  onClose: () => void;
  closeTitle?: string;
  titleStyle?: CSSProperties;
  marginBottom?: number | string;
};

export function InspectorPanelHeader({
  title,
  onClose,
  closeTitle = "Close",
  titleStyle,
  marginBottom = "12px",
}: InspectorPanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom,
      }}
    >
      <strong style={titleStyle}>{title}</strong>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <InspectorExpandButton />
        <CloseButton onClick={onClose} title={closeTitle} />
      </div>
    </div>
  );
}
