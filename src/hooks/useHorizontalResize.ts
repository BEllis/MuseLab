import { useCallback, useEffect, useRef, useState } from "react";

type UseHorizontalResizeOptions = {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  /** Which edge the drag handle sits on. Default `right` (left panel). Use `left` for right-side panels. */
  resizeEdge?: "left" | "right";
};

function readStoredWidth(storageKey: string | undefined, fallback: number): number {
  if (!storageKey) return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function clampWidth(value: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, value));
}

export function useHorizontalResize({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
  resizeEdge = "right",
}: UseHorizontalResizeOptions) {
  const [width, setWidth] = useState(() =>
    clampWidth(readStoredWidth(storageKey, initialWidth), minWidth, maxWidth)
  );
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsResizing(true);

      const startX = event.clientX;
      const startWidth = widthRef.current;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = clampWidth(
          resizeEdge === "left" ? startWidth - delta : startWidth + delta,
          minWidth,
          maxWidth
        );
        setWidth(nextWidth);
      };

      const finishResize = () => {
        setIsResizing(false);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, String(widthRef.current));
          } catch {
            // ignore
          }
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
    },
    [maxWidth, minWidth, resizeEdge, storageKey]
  );

  return { width, isResizing, onResizePointerDown };
}
