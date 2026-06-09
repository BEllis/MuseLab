import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  buildStoryTree,
  collectDescendantGroupIds,
  getStoryGroups,
  getStoryTreeSiblings,
} from "@/core/model/storyTree";
import type { StoryTreeNode, StoryTreePlacement, StoryTreeSibling } from "@/core/model/storyTree";
import { AddButton } from "./AddButton";
import { CloseButton } from "./CloseButton";

const STORY_TREE_DRAG_MIME = "application/x-muselab-story-tree-item";

type StoryTreeDragItem = StoryTreeSibling;

type InsertionTarget = StoryTreePlacement;

function encodeDragItem(item: StoryTreeDragItem): string {
  return JSON.stringify(item);
}

function decodeDragItem(raw: string): StoryTreeDragItem | null {
  try {
    const parsed = JSON.parse(raw) as StoryTreeDragItem;
    if (parsed?.kind !== "story" && parsed?.kind !== "group") return null;
    if (typeof parsed.id !== "string" || parsed.id.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readDragItem(
  dataTransfer: DataTransfer,
  activeItem: StoryTreeDragItem | null
): StoryTreeDragItem | null {
  if (activeItem) return activeItem;
  const raw = dataTransfer.getData(STORY_TREE_DRAG_MIME);
  return raw ? decodeDragItem(raw) : null;
}

function DragHandleIcon() {
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

function placementKey(placement: InsertionTarget): string {
  return `${placement.parentGroupId ?? "root"}:${placement.index}`;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
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

function FolderIcon() {
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

function StoryIcon() {
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

export function StoryTreeView() {
  const project = useProjectStore((s) => s.project);
  const activeStoryId = useProjectStore((s) => s.activeStoryId);
  const setActiveStoryId = useProjectStore((s) => s.setActiveStoryId);
  const addStory = useProjectStore((s) => s.addStory);
  const removeStory = useProjectStore((s) => s.removeStory);
  const updateStory = useProjectStore((s) => s.updateStory);
  const addStoryGroup = useProjectStore((s) => s.addStoryGroup);
  const removeStoryGroup = useProjectStore((s) => s.removeStoryGroup);
  const updateStoryGroup = useProjectStore((s) => s.updateStoryGroup);
  const placeStoryTreeItem = useProjectStore((s) => s.placeStoryTreeItem);

  const [editing, setEditing] = useState<{ kind: "story" | "group"; id: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [insertionTarget, setInsertionTarget] = useState<InsertionTarget | null>(null);
  const [nestGroupId, setNestGroupId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<StoryTreeDragItem | null>(null);

  const tree = useMemo(() => buildStoryTree(project), [project]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (
        addMenuRef.current &&
        target instanceof HTMLElement &&
        !addMenuRef.current.contains(target)
      ) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuOpen]);

  const clearDragState = useCallback(() => {
    dragItemRef.current = null;
    setInsertionTarget(null);
    setNestGroupId(null);
  }, []);

  useEffect(() => {
    if (!editing) return;
    if (editing.kind === "story" && !project.stories.some((story) => story.id === editing.id)) {
      setEditing(null);
    }
    if (
      editing.kind === "group" &&
      !getStoryGroups(project).some((group) => group.id === editing.id)
    ) {
      setEditing(null);
    }
  }, [editing, project]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const startEdit = useCallback((kind: "story" | "group", id: string, name: string) => {
    setEditing({ kind, id });
    setEditName(name);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const trimmed = editName.trim();
    if (editing.kind === "story") {
      const story = project.stories.find((entry) => entry.id === editing.id);
      if (story && trimmed && trimmed !== story.name) {
        updateStory(editing.id, { name: trimmed });
      }
    } else {
      const group = getStoryGroups(project).find((entry) => entry.id === editing.id);
      if (group && trimmed && trimmed !== group.name) {
        updateStoryGroup(editing.id, { name: trimmed });
      }
    }
    setEditing(null);
  }, [editName, editing, project, updateStory, updateStoryGroup]);

  const handleDeleteStory = useCallback(
    (storyId: string, name: string) => {
      if (project.stories.length <= 1) return;
      if (!window.confirm(`Delete story "${name}" and all of its scenes?`)) return;
      removeStory(storyId);
    },
    [project.stories.length, removeStory]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string, name: string) => {
      if (!window.confirm(`Delete folder "${name}" and move its contents up one level?`)) return;
      removeStoryGroup(groupId);
    },
    [removeStoryGroup]
  );

  const canNestGroupInGroup = useCallback(
    (item: StoryTreeDragItem, targetGroupId: string): boolean => {
      if (item.kind === "story") return true;
      if (item.id === targetGroupId) return false;
      const descendants = new Set(collectDescendantGroupIds(getStoryGroups(project), item.id));
      return !descendants.has(targetGroupId);
    },
    [project]
  );

  const dropIntoGroup = useCallback(
    (item: StoryTreeDragItem, groupId: string) => {
      if (!canNestGroupInGroup(item, groupId)) return;
      const siblings = getStoryTreeSiblings(project, groupId).filter(
        (entry) => !(entry.kind === item.kind && entry.id === item.id)
      );
      placeStoryTreeItem(item, { parentGroupId: groupId, index: siblings.length });
    },
    [canNestGroupInGroup, placeStoryTreeItem, project]
  );

  const handleDragStart = useCallback((event: React.DragEvent, item: StoryTreeDragItem) => {
    dragItemRef.current = item;
    event.dataTransfer.setData(STORY_TREE_DRAG_MIME, encodeDragItem(item));
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const getActiveDragItem = useCallback((event: React.DragEvent) => {
    return readDragItem(event.dataTransfer, dragItemRef.current);
  }, []);

  const handleInsertionDragOver = useCallback(
    (event: React.DragEvent, placement: InsertionTarget) => {
      const item = getActiveDragItem(event);
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setInsertionTarget(placement);
      setNestGroupId(null);
    },
    [getActiveDragItem]
  );

  const handleInsertionDrop = useCallback(
    (event: React.DragEvent, placement: InsertionTarget) => {
      event.preventDefault();
      event.stopPropagation();
      const item = getActiveDragItem(event);
      clearDragState();
      if (!item) return;
      if (item.kind === "group" && placement.parentGroupId === item.id) return;
      if (
        item.kind === "group" &&
        placement.parentGroupId &&
        !canNestGroupInGroup(item, placement.parentGroupId)
      ) {
        return;
      }
      placeStoryTreeItem(item, placement);
    },
    [canNestGroupInGroup, clearDragState, getActiveDragItem, placeStoryTreeItem]
  );

  const handleGroupNestDragOver = useCallback(
    (event: React.DragEvent, groupId: string) => {
      const item = getActiveDragItem(event);
      if (!item || !canNestGroupInGroup(item, groupId)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setNestGroupId(groupId);
      setInsertionTarget(null);
    },
    [canNestGroupInGroup, getActiveDragItem]
  );

  const handleGroupNestDrop = useCallback(
    (event: React.DragEvent, groupId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const item = getActiveDragItem(event);
      clearDragState();
      if (!item) return;
      dropIntoGroup(item, groupId);
    },
    [clearDragState, dropIntoGroup, getActiveDragItem]
  );

  const renderDragHandle = (item: StoryTreeDragItem, disabled: boolean) => (
    <span
      className="story-tree-drag-handle"
      draggable={!disabled}
      title="Drag to reorder"
      aria-label="Drag to reorder"
      onDragStart={(event) => {
        event.stopPropagation();
        handleDragStart(event, item);
      }}
      onDragEnd={clearDragState}
      onClick={(event) => event.stopPropagation()}
    >
      <DragHandleIcon />
    </span>
  );

  const renderNameEditor = () => (
    <input
      type="text"
      value={editName}
      autoFocus
      onChange={(e) => setEditName(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setEditing(null);
        }
      }}
      className="story-tree-name-input"
    />
  );

  const renderInsertionZone = (placement: InsertionTarget, depth: number) => {
    const active =
      insertionTarget !== null && placementKey(insertionTarget) === placementKey(placement);

    return (
      <li
        key={`insert-${placement.parentGroupId ?? "root"}-${placement.index}`}
        className={`story-tree-insertion${active ? " is-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onDragOver={(event) => handleInsertionDragOver(event, placement)}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          if (insertionTarget && placementKey(insertionTarget) === placementKey(placement)) {
            setInsertionTarget(null);
          }
        }}
        onDrop={(event) => handleInsertionDrop(event, placement)}
      />
    );
  };

  const renderStoryRow = (node: Extract<StoryTreeNode, { kind: "story" }>, depth: number) => {
    const selected = node.id === activeStoryId;
    const isEditing = editing?.kind === "story" && editing.id === node.id;

    return (
      <li key={node.id} className="story-tree-item">
        <div
          className={`story-tree-row${selected ? " is-selected" : ""}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setActiveStoryId(node.id)}
        >
          {renderDragHandle({ kind: "story", id: node.id }, isEditing)}
          <span className="story-tree-icon">
            <StoryIcon />
          </span>
          {isEditing ? (
            renderNameEditor()
          ) : (
            <button
              type="button"
              className="story-tree-name"
              onClick={(e) => {
                e.stopPropagation();
                startEdit("story", node.id, node.name);
              }}
            >
              {node.name}
            </button>
          )}
          <span onClick={(event) => event.stopPropagation()}>
            <CloseButton
              title="Delete story"
              disabled={project.stories.length <= 1}
              onClick={() => handleDeleteStory(node.id, node.name)}
            />
          </span>
        </div>
      </li>
    );
  };

  const renderLevel = (parentGroupId: string | undefined, depth: number, nodes: StoryTreeNode[]) => {
    const elements: JSX.Element[] = [renderInsertionZone({ parentGroupId, index: 0 }, depth)];

    nodes.forEach((node, index) => {
      if (node.kind === "story") {
        elements.push(renderStoryRow(node, depth));
      } else {
        const expanded = !collapsedGroupIds.has(node.id);
        const isEditing = editing?.kind === "group" && editing.id === node.id;
        const isNestTarget = nestGroupId === node.id;

        elements.push(
          <li key={node.id} className="story-tree-item">
            <div
              className={`story-tree-row story-tree-group-row${isNestTarget ? " is-nest-target" : ""}`}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              onDragOver={(event) => handleGroupNestDragOver(event, node.id)}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (nestGroupId === node.id) setNestGroupId(null);
              }}
              onDrop={(event) => handleGroupNestDrop(event, node.id)}
            >
              {renderDragHandle({ kind: "group", id: node.id }, isEditing)}
              <button
                type="button"
                className="story-tree-toggle"
                aria-label={expanded ? "Collapse folder" : "Expand folder"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleGroup(node.id);
                }}
              >
                <ChevronIcon expanded={expanded} />
              </button>
              <span className="story-tree-icon">
                <FolderIcon />
              </span>
              {isEditing ? (
                renderNameEditor()
              ) : (
                <button
                  type="button"
                  className="story-tree-name"
                  onClick={(event) => {
                    event.stopPropagation();
                    startEdit("group", node.id, node.name);
                  }}
                >
                  {node.name}
                </button>
              )}
              <span onClick={(event) => event.stopPropagation()}>
                <CloseButton
                  title="Delete folder"
                  onClick={() => handleDeleteGroup(node.id, node.name)}
                />
              </span>
            </div>
            {expanded && (
              <ul className="story-tree-list">{renderLevel(node.id, depth + 1, node.children)}</ul>
            )}
          </li>
        );
      }

      elements.push(renderInsertionZone({ parentGroupId, index: index + 1 }, depth));
    });

    return elements;
  };

  return (
    <div className="story-tree">
      <div className="story-tree-toolbar">
        <div ref={addMenuRef} style={{ position: "relative" }}>
          <AddButton
            onClick={() => setAddMenuOpen((open) => !open)}
            title="Add story or group"
          />
          {addMenuOpen && (
            <div
              className="app-context-menu"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                zIndex: 20,
                minWidth: "140px",
              }}
            >
              <button
                type="button"
                className="app-context-menu-item"
                onClick={() => {
                  addStory();
                  setAddMenuOpen(false);
                }}
              >
                Add Story
              </button>
              <button
                type="button"
                className="app-context-menu-item"
                onClick={() => {
                  addStoryGroup();
                  setAddMenuOpen(false);
                }}
              >
                Add Group
              </button>
            </div>
          )}
        </div>
      </div>
      <ul className="story-tree-list story-tree-root">{renderLevel(undefined, 0, tree)}</ul>
    </div>
  );
}
