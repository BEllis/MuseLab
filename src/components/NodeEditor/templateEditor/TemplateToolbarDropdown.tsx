import { useEffect, useRef, useState, type ReactNode } from "react";

const triggerStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid var(--app-button-border)",
  borderRadius: "4px",
  background: "var(--app-button-bg)",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

export function TemplateToolbarDropdown({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerOutside = (event: Event) => {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    // Capture phase: CodeMirror and other editors often stop mousedown propagation.
    document.addEventListener("mousedown", handlePointerOutside, true);
    document.addEventListener("pointerdown", handlePointerOutside, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerOutside, true);
      document.removeEventListener("pointerdown", handlePointerOutside, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={triggerStyle}
      >
        {label}
        <span aria-hidden style={{ fontSize: "10px", opacity: 0.7 }}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="app-context-menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            zIndex: 20,
            minWidth: "160px",
          }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function TemplateToolbarMenuItem({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="app-context-menu-item"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
