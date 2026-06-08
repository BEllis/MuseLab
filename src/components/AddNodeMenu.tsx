import { useEffect, useRef, useState } from "react";
import { AddButton } from "./AddButton";
import type { StoryNodeType } from "@/core/model/types";

type AddNodeMenuProps = {
  onAdd: (type: StoryNodeType) => void;
  variant?: "toolbar" | "overlay";
};

const MENU_OPTIONS: { type: StoryNodeType; label: string }[] = [
  { type: "start", label: "Create Start Point" },
  { type: "scene", label: "Create New Scene" },
  { type: "jump", label: "Create Jump To" },
];

export function AddNodeMenu({ onAdd, variant = "toolbar" }: AddNodeMenuProps) {
  const overlay = variant === "overlay";
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
    <div
      ref={containerRef}
      style={
        overlay
          ? { position: "absolute", top: 12, left: 12, zIndex: 6 }
          : { position: "relative" }
      }
    >
      <AddButton
        onClick={() => setOpen((value) => !value)}
        title="Add node"
        variant={overlay ? "overlay" : "default"}
      />
      {open && (
        <div
          className="app-context-menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: overlay ? "8px" : "4px",
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
