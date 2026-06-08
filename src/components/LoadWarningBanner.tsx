import { useProjectStore } from "@/store/projectStore";

export function LoadWarningBanner() {
  const loadWarnings = useProjectStore((state) => state.loadWarnings);
  const dismissLoadWarnings = useProjectStore((state) => state.dismissLoadWarnings);

  if (loadWarnings.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "10px 16px",
        background: "var(--app-warning-bg, #4a3b00)",
        color: "var(--app-warning-text, #fff8e7)",
        borderBottom: "1px solid var(--app-warning-border, #8a6d00)",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", marginBottom: "4px" }}>
          Project loaded with warnings
        </strong>
        {loadWarnings.map((warning) => (
          <div key={warning}>{warning}</div>
        ))}
      </div>
      <button
        type="button"
        className="app-toolbar-button"
        onClick={dismissLoadWarnings}
        style={{ flexShrink: 0 }}
      >
        Dismiss
      </button>
    </div>
  );
}
