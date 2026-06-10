import { useRef } from "react";

export const TREE_ROW_BASE_PADDING = 8;
export const TREE_ROW_DEPTH_INDENT = 14;

export function treeRowPaddingLeft(depth: number): number {
  return TREE_ROW_BASE_PADDING + depth * TREE_ROW_DEPTH_INDENT;
}

export function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden>
      <circle cx="3" cy="2.5" r="1" fill="currentColor" />
      <circle cx="7" cy="2.5" r="1" fill="currentColor" />
      <circle cx="3" cy="7" r="1" fill="currentColor" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="3" cy="11.5" r="1" fill="currentColor" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d={expanded ? "M3 4.5 6 7.5 9 4.5" : "M4.5 3 7.5 6 4.5 9"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.75 4.25h4l1 1.25H12.25V11H1.75V4.25Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 2.75h4.25v8.5H3.2c-.12 0-.2-.08-.2-.2V2.75Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M7.25 2.75H11v7.95c0 .12-.08.2-.2.2H7.25V2.75Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="4.25" r="2.25" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M3.25 12.25c.75-2.25 2.35-3.5 3.75-3.5s3 1.25 3.75 3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TreeToggleSpacer() {
  return <span className="story-tree-toggle-spacer" aria-hidden />;
}

export function TreeChevronToggle({
  expanded,
  ariaLabel,
  onClick,
}: {
  expanded: boolean;
  ariaLabel: string;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className="story-tree-toggle"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <ChevronIcon expanded={expanded} />
    </button>
  );
}

export function TreeDragHandle({
  disabled = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  onSelect,
}: {
  disabled?: boolean;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragEnd?: () => void;
  onSelect?: () => void;
}) {
  const draggedRef = useRef(false);

  return (
    <span
      className={`story-tree-drag-handle${disabled ? " is-disabled" : ""}`}
      draggable={draggable && !disabled}
      title={disabled ? undefined : "Drag to reorder"}
      aria-label={disabled ? undefined : "Drag to reorder"}
      aria-hidden={disabled || undefined}
      onDragStart={(event) => {
        draggedRef.current = true;
        event.stopPropagation();
        onDragStart?.(event);
      }}
      onDragEnd={() => {
        onDragEnd?.();
        window.setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onSelect?.();
      }}
    >
      <DragHandleIcon />
    </span>
  );
}
