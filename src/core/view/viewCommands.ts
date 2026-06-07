export const VIEW_COMMANDS = {
  zoomIn: "muselab:view-zoom-in",
  zoomOut: "muselab:view-zoom-out",
  zoomReset: "muselab:view-zoom-reset",
} as const;

export type ViewCommand = keyof typeof VIEW_COMMANDS;

export function dispatchViewCommand(command: ViewCommand): void {
  window.dispatchEvent(new CustomEvent(VIEW_COMMANDS[command]));
}

export function runEditCommand(command: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"): void {
  document.execCommand(command);
}

export function reloadPage(force = false): void {
  if (force) {
    const url = new URL(window.location.href);
    url.searchParams.set("_", String(Date.now()));
    window.location.href = url.toString();
    return;
  }
  window.location.reload();
}

export async function toggleFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}
