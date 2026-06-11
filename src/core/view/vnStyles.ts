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

export const vnSpeakerTabStyle: CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  marginLeft: "12px",
  marginBottom: "-2px",
  background: "#c5dff0",
  border: "2px solid #1e5a8a",
  borderBottom: "none",
  borderRadius: "12px 12px 0 0",
  padding: "4px 14px",
  color: "#1e5a8a",
  fontSize: "14px",
  lineHeight: 1.2,
};

export const compactVnSpeakerTabStyle: CSSProperties = {
  ...vnSpeakerTabStyle,
  marginLeft: "4px",
  marginBottom: "-1px",
  borderWidth: "1px",
  borderRadius: "4px 4px 0 0",
  padding: "0 4px",
  fontSize: "4px",
  lineHeight: 1.25,
};

export function vnDialogueBoxStyle(compact: boolean): CSSProperties {
  return compact ? compactVnBoxStyle : vnBoxStyle;
}

/** Fixed dialogue body height; scales with stage via inherited font size / compact mode. */
export const vnDialogueBoxHeight = "9em";
export const compactVnDialogueBoxHeight = "3.6em";

export function vnDialogueBoxChromeStyle(compact: boolean): CSSProperties {
  const height = compact ? compactVnDialogueBoxHeight : vnDialogueBoxHeight;
  return {
    ...vnDialogueBoxStyle(compact),
    position: "relative",
    height,
    minHeight: height,
    overflow: "hidden",
  };
}

/** Vertical space reserved at the bottom of the text viewport for corner hints. */
export const DIALOGUE_HINT_RESERVE_PX = 22;
export const COMPACT_DIALOGUE_HINT_RESERVE_PX = 6;

export function dialogueHintReservePx(compact: boolean, hintMayShow: boolean): number {
  if (!hintMayShow) return 0;
  return compact ? COMPACT_DIALOGUE_HINT_RESERVE_PX : DIALOGUE_HINT_RESERVE_PX;
}

export function dialogueContentHeightPx(
  viewportClientHeight: number,
  compact: boolean,
  hintReservePx: number,
): number {
  const verticalPadding = compact ? 0 : 4;
  return Math.max(0, viewportClientHeight - verticalPadding - hintReservePx);
}

/** Clipped dialogue viewport; pins the text container to the bottom (outer-container). */
export function vnDialogueScrollStyle(compact: boolean, hintReservePx = 0): CSSProperties {
  const edgePadding = compact ? 0 : 2;
  return {
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    ...(compact
      ? {}
      : {
          paddingTop: edgePadding,
          paddingRight: 6,
          paddingLeft: 6,
          paddingBottom: edgePadding + hintReservePx,
        }),
  };
}

/** Grows with content, fills the viewport when short, text flows from the top (text-container). */
export function vnDialogueTextContainerStyle(contentViewportHeightPx: number): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "stretch",
    flexShrink: 0,
    minHeight: contentViewportHeightPx > 0 ? contentViewportHeightPx : "100%",
  };
}

/** Bottom-right corner container for caption hints; does not span the dialogue width. */
export function vnDialogueHintCornerStyle(compact: boolean): CSSProperties {
  return {
    position: "absolute",
    right: compact ? 3 : 12,
    bottom: compact ? 1 : 6,
    width: "max-content",
    maxWidth: compact ? "40%" : "50%",
    zIndex: 1,
    pointerEvents: "none",
  };
}
