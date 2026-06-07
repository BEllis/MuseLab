type PlayValidationDialogProps = {
  message: string;
  onClose: () => void;
};

export function PlayValidationDialog({ message, onClose }: PlayValidationDialogProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="play-validation-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-overlay)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(420px, 90vw)",
          background: "var(--app-surface)",
          color: "var(--app-text)",
          borderRadius: "8px",
          boxShadow: "0 8px 32px var(--app-shadow)",
          padding: "20px 24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="play-validation-title"
          style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 600 }}
        >
          Cannot play yet
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.5, color: "var(--app-text-muted)" }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="app-toolbar-button">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
