import { useEffect, useRef, useState } from "react";
import { AddButton } from "./AddButton";
import type { StoryNodeType } from "@/core/model/types";

type AddNodeMenuProps = {
  onAdd: (type: StoryNodeType) => void;
};

const MENU_OPTIONS: { type: StoryNodeType; label: string }[] = [
  { type: "start", label: "Create Start Point" },
  { type: "scene", label: "Create New Scene" },
  { type: "jump", label: "Create Jump To" },
];

export function AddNodeMenu({ onAdd }: AddNodeMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof HTMLElement &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <AddButton
        onClick={() => setOpen((value) => !value)}
        title="Add node"
      />
      {open && (
        <div
          className="app-context-menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            zIndex: 20,
            minWidth: "180px",
          }}
        >
          {MENU_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className="app-context-menu-item"
              onClick={() => {
                onAdd(option.type);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
