import { useEffect } from "react";
import { useScriptImportDialogStore } from "@/store/scriptImportDialogStore";

export function ScriptImportDialog() {
  const open = useScriptImportDialogStore((s) => s.open);
  const success = useScriptImportDialogStore((s) => s.success);
  const reasons = useScriptImportDialogStore((s) => s.reasons);
  const hide = useScriptImportDialogStore((s) => s.hide);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hide]);

  if (!open) return null;

  const title = success ? "Import Succeeded" : "Import Failure";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="script-import-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-overlay)",
      }}
      onClick={hide}
    >
      <div
        style={{
          width: "min(520px, 90vw)",
          maxHeight: "min(70vh, 640px)",
          overflow: "auto",
          background: "var(--app-surface)",
          color: "var(--app-text)",
          borderRadius: "8px",
          boxShadow: "0 8px 32px var(--app-shadow)",
          padding: "20px 24px",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="script-import-title"
          style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 600 }}
        >
          {title}
        </h2>
        {success ? (
          <>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--app-text-muted)",
              }}
            >
              The script was imported successfully.
            </p>
            {reasons.length > 0 && (
              <>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Notes
                </p>
                <ul
                  style={{
                    margin: "0 0 20px",
                    paddingLeft: "20px",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    color: "var(--app-text-muted)",
                  }}
                >
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--app-text-muted)",
              }}
            >
              The script could not be imported.
            </p>
            <ul
              style={{
                margin: "0 0 20px",
                paddingLeft: "20px",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--app-text-muted)",
              }}
            >
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={hide} className="app-toolbar-button">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
