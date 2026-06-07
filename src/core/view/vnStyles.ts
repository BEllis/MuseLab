import type { CSSProperties } from "react";

export const vnBoxStyle: CSSProperties = {
  background: "#c5dff0",
  border: "2px solid #1e5a8a",
  borderRadius: "12px",
  padding: "16px 20px",
  color: "#0f172a",
  boxShadow: "0 4px 16px rgba(30, 90, 138, 0.25)",
};

export const vnButtonStyle: CSSProperties = {
  ...vnBoxStyle,
  cursor: "pointer",
  fontSize: "16px",
  textAlign: "left",
  width: "100%",
  fontFamily: "inherit",
};

/** Bottom dialogue strip height in the full player stage. */
export const DIALOGUE_PANEL_HEIGHT = "220px";

/** Dialogue strip as a fraction of stage height (compact previews). */
export const DIALOGUE_PANEL_FRACTION = 0.32;

export const compactVnBoxStyle: CSSProperties = {
  ...vnBoxStyle,
  borderRadius: "4px",
  borderWidth: "1px",
  padding: "3px 5px",
  fontSize: "5px",
  lineHeight: 1.25,
  boxShadow: "0 1px 4px rgba(30, 90, 138, 0.2)",
};

export const compactVnButtonStyle: CSSProperties = {
  ...compactVnBoxStyle,
  fontSize: "4.5px",
  padding: "2px 4px",
  borderRadius: "3px",
};
