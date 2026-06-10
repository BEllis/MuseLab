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
import {
  ChevronIcon,
  FolderIcon,
  StoryIcon,
  TreeChevronToggle,
  TreeDragHandle,
  TreeToggleSpacer,
  treeRowPaddingLeft,
} from "./tree/treeViewUi";

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

function placementKey(placement: InsertionTarget): string {
  return `${placement.parentGroupId ?? "root"}:${placement.index}`;
}

export function StoryTreeView() {
  const project = useProjectStore((s) => s.project);
  const selectedStoryId = useProjectStore((s) => s.selectedStoryId);
  const selectStory = useProjectStore((s) => s.selectStory);
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
  const [sectionExpanded, setSectionExpanded] = useState(true);
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

  const startEdit = useCallback(
    (kind: "story" | "group", id: string, name: string) => {
      if (kind === "story") {
        selectStory(id);
      }
      setEditing({ kind, id });
      setEditName(name);
    },
    [selectStory]
  );

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

  const renderDragHandle = (
    item: StoryTreeDragItem,
    disabled: boolean,
    onSelect?: () => void
  ) => (
    <TreeDragHandle
      disabled={disabled}
      onSelect={disabled ? undefined : onSelect}
      onDragStart={(event) => handleDragStart(event, item)}
      onDragEnd={clearDragState}
    />
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
        style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
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
    const selected = node.id === selectedStoryId;
    const isEditing = editing?.kind === "story" && editing.id === node.id;

    return (
      <li key={node.id} className="story-tree-item">
        <div
          className={`story-tree-row${selected ? " is-selected" : ""}`}
          style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
          onClick={() => selectStory(node.id)}
        >
          <TreeToggleSpacer />
          {renderDragHandle({ kind: "story", id: node.id }, isEditing, () =>
            selectStory(node.id)
          )}
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
          <span className="story-tree-row-actions" onClick={(event) => event.stopPropagation()}>
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
              style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
              onDragOver={(event) => handleGroupNestDragOver(event, node.id)}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (nestGroupId === node.id) setNestGroupId(null);
              }}
              onDrop={(event) => handleGroupNestDrop(event, node.id)}
            >
              <TreeChevronToggle
                expanded={expanded}
                ariaLabel={expanded ? "Collapse folder" : "Expand folder"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleGroup(node.id);
                }}
              />
              {renderDragHandle({ kind: "group", id: node.id }, isEditing)}
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
              <span className="story-tree-row-actions" onClick={(event) => event.stopPropagation()}>
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
    <div className="story-tree asset-tree-section">
      <div className="story-tree-toolbar asset-tree-section-header">
        <button
          type="button"
          className="story-tree-section-title"
          onClick={() => setSectionExpanded((expanded) => !expanded)}
        >
          <ChevronIcon expanded={sectionExpanded} />
          <span>Stories</span>
        </button>
        <div ref={addMenuRef} className="app-tree-add-menu">
          <AddButton
            onClick={() => setAddMenuOpen((open) => !open)}
            title="Add story or group"
          />
          {addMenuOpen && (
            <div className="app-context-menu app-tree-add-menu-dropdown">
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
      {sectionExpanded && (
        <ul className="story-tree-list story-tree-root">{renderLevel(undefined, 0, tree)}</ul>
      )}
    </div>
  );
}
