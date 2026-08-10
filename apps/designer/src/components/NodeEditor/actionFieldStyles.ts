import type { CSSProperties } from "react";

export const fieldStyle: CSSProperties = {
  padding: "3px 6px",
  border: "1px solid var(--app-border)",
  borderRadius: "5px",
  background: "var(--app-surface)",
  color: "var(--app-text)",
  fontSize: "12px",
  fontFamily: "inherit",
  minWidth: 0,
};

export const numberFieldStyle: CSSProperties = {
  ...fieldStyle,
  width: "70px",
};

export const labelStyle: CSSProperties = {
  fontSize: "11px",
  color: "var(--app-text-muted, #64748b)",
  whiteSpace: "nowrap",
};

export const fieldGroupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  minWidth: 0,
};
