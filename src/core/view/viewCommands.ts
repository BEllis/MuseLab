import { useProjectStore } from "@/store/projectStore";

export const VIEW_COMMANDS = {
  zoomIn: "muselab:view-zoom-in",
  zoomOut: "muselab:view-zoom-out",
  zoomReset: "muselab:view-zoom-reset",
} as const;

export type ViewCommand = keyof typeof VIEW_COMMANDS;

export function dispatchViewCommand(command: ViewCommand): void {
  window.dispatchEvent(new CustomEvent(VIEW_COMMANDS[command]));
}

export function isTextEditingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

export function runEditCommand(command: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"): void {
  document.execCommand(command);
}

export function runProjectEditCommand(command: "undo" | "redo"): boolean {
  const active = document.activeElement;
  if (isTextEditingTarget(active)) {
    runEditCommand(command);
    return false;
  }

  const store = useProjectStore.getState();
  if (command === "undo") {
    if (!store.canUndo) return false;
    store.undo();
    return true;
  }
  if (!store.canRedo) return false;
  store.redo();
  return true;
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
