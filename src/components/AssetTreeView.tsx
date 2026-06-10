import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { AssetType, Project } from "@/core/model/types";
import {
  buildAssetTreeForType,
  collectDescendantAssetGroupIds,
  getAssetGroupsForType,
  getAssetTreeSiblings,
  type AssetTreeExpressionNode,
  type AssetTreeNode,
  type AssetTreePlacement,
  type AssetTreeSibling,
} from "@/core/model/assetTree";
import {
  DEFAULT_BACKDROP_ID,
  canRemoveAsset,
  canReplaceAsset,
  isDefaultBackdrop,
} from "@/core/assets/defaultBackdrop";
import { getAssetUrlAsync, getActorExpressionUrlAsync } from "@/core/assets/resolver";
import { getExpressionUsage } from "@/core/assets/actorExpressions";
import { setAssetDragData } from "@/utils/dragDrop";
import { isElectron } from "@/utils/isElectron";
import { AddButton } from "./AddButton";
import { CloseButton } from "./CloseButton";
import { ReplaceImageButton } from "./ReplaceImageButton";
import {
  ActorIcon,
  ChevronIcon,
  FolderIcon,
  TreeChevronToggle,
  TreeDragHandle,
  TreeToggleSpacer,
  treeRowPaddingLeft,
} from "./tree/treeViewUi";

const ASSET_TREE_DRAG_MIME = "application/x-muselab-asset-tree-item";
const THUMB_SIZE = 28;

type AssetTreeDragItem = AssetTreeSibling;

function encodeDragItem(item: AssetTreeDragItem): string {
  return JSON.stringify(item);
}

function decodeDragItem(raw: string): AssetTreeDragItem | null {
  try {
    const parsed = JSON.parse(raw) as AssetTreeDragItem;
    if (parsed?.kind === "expression") {
      if (typeof parsed.id !== "string" || typeof parsed.actorId !== "string") return null;
      return parsed;
    }
    if (parsed?.kind !== "group" && parsed?.kind !== "asset") return null;
    if (typeof parsed.id !== "string" || parsed.id.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readDragItem(
  dataTransfer: DataTransfer,
  activeItem: AssetTreeDragItem | null
): AssetTreeDragItem | null {
  if (activeItem) return activeItem;
  const raw = dataTransfer.getData(ASSET_TREE_DRAG_MIME);
  return raw ? decodeDragItem(raw) : null;
}

function placementKey(placement: AssetTreePlacement): string {
  return `${placement.assetType}:${placement.parentGroupId ?? "root"}:${placement.parentActorId ?? "none"}:${placement.index}`;
}

function sectionTitle(assetType: AssetType): string {
  switch (assetType) {
    case "backdrop":
      return "Backdrops";
    case "actor":
      return "Actors/Props";
    case "sound":
      return "Sound Clips";
  }
}

function SoundIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 5.25h2.25L8.75 3.5v7L5.75 8.75H3.5V5.25Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M10 5.5a2.25 2.25 0 0 1 0 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssetThumb({
  project,
  assetId,
  assetType,
  onCanvasDragStart,
  onCanvasDragEnd,
}: {
  project: Project;
  assetId: string;
  assetType: Exclude<AssetType, "actor">;
  onCanvasDragStart: () => void;
  onCanvasDragEnd: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setThumbUrl(null);
    getAssetUrlAsync(projectRef.current, assetId)
      .then((url) => {
        if (!cancelled && url) setThumbUrl(url);
        if (!cancelled && !url) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, project]);

  if (assetType === "sound") {
    return (
      <span
        className="story-tree-icon"
        draggable
        title="Drag to canvas"
        onDragStart={(event) => {
          event.stopPropagation();
          onCanvasDragStart();
          setAssetDragData(event.dataTransfer, { type: "sound", assetId });
        }}
        onDragEnd={onCanvasDragEnd}
        onClick={(event) => event.stopPropagation()}
      >
        <SoundIcon />
      </span>
    );
  }

  return (
    <div
      draggable
      title="Drag to canvas"
      onDragStart={(event) => {
        event.stopPropagation();
        onCanvasDragStart();
        setAssetDragData(event.dataTransfer, { type: "backdrop", assetId });
      }}
      onDragEnd={onCanvasDragEnd}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        flexShrink: 0,
        borderRadius: "4px",
        overflow: "hidden",
        background: "var(--app-border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
      }}
    >
      {thumbUrl && !error ? (
        <img
          src={thumbUrl}
          alt=""
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span style={{ fontSize: "9px", color: "var(--app-text-subtle)" }}>…</span>
      )}
    </div>
  );
}

function ExpressionThumb({
  project,
  actorId,
  expressionId,
  onCanvasDragStart,
  onCanvasDragEnd,
  onSelect,
}: {
  project: Project;
  actorId: string;
  expressionId: string;
  onCanvasDragStart: () => void;
  onCanvasDragEnd: () => void;
  onSelect: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setThumbUrl(null);
    getActorExpressionUrlAsync(projectRef.current, actorId, expressionId)
      .then((url) => {
        if (!cancelled && url) setThumbUrl(url);
        if (!cancelled && !url) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [actorId, expressionId, project]);

  return (
    <div
      draggable
      title="Drag to canvas"
      onDragStart={(event) => {
        event.stopPropagation();
        onCanvasDragStart();
        setAssetDragData(event.dataTransfer, {
          type: "actor",
          assetId: actorId,
          expressionId,
        });
      }}
      onDragEnd={onCanvasDragEnd}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        flexShrink: 0,
        borderRadius: "4px",
        overflow: "hidden",
        background: "var(--app-border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
      }}
    >
      {thumbUrl && !error ? (
        <img
          src={thumbUrl}
          alt=""
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span style={{ fontSize: "9px", color: "var(--app-text-subtle)" }}>…</span>
      )}
    </div>
  );
}

function AssetTreeSection({
  assetType,
  fileInputRef,
}: {
  assetType: AssetType;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const project = useProjectStore((s) => s.project);
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useProjectStore((s) => s.setSelectedAssetId);
  const addAsset = useProjectStore((s) => s.addAsset);
  const addBlankActor = useProjectStore((s) => s.addBlankActor);
  const addActorFromImage = useProjectStore((s) => s.addActorFromImage);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const updateAsset = useProjectStore((s) => s.updateAsset);
  const addAssetGroup = useProjectStore((s) => s.addAssetGroup);
  const removeAssetGroup = useProjectStore((s) => s.removeAssetGroup);
  const updateAssetGroup = useProjectStore((s) => s.updateAssetGroup);
  const updateActorExpression = useProjectStore((s) => s.updateActorExpression);
  const replaceActorExpressionMedia = useProjectStore((s) => s.replaceActorExpressionMedia);
  const replaceAssetMedia = useProjectStore((s) => s.replaceAssetMedia);
  const removeActorExpression = useProjectStore((s) => s.removeActorExpression);
  const placeAssetTreeItem = useProjectStore((s) => s.placeAssetTreeItem);

  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [editing, setEditing] = useState<
    { kind: "asset" | "group" | "expression"; id: string; actorId?: string } | null
  >(null);
  const [editName, setEditName] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [collapsedActorIds, setCollapsedActorIds] = useState<Set<string>>(() => new Set());
  const [insertionTarget, setInsertionTarget] = useState<AssetTreePlacement | null>(null);
  const [nestGroupId, setNestGroupId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<AssetTreeDragItem | null>(null);
  const canvasDragRef = useRef(false);
  const replaceExpressionRef = useRef<{ actorId: string; expressionId: string } | null>(null);
  const replaceAssetRef = useRef<string | null>(null);

  const tree = useMemo(() => buildAssetTreeForType(project, assetType), [project, assetType]);
  const hasAssetsOfType = useMemo(
    () => project.assets.some((asset) => asset.type === assetType),
    [project.assets, assetType]
  );
  const defaultBackdrop = useMemo(
    () => project.assets.find((asset) => asset.id === DEFAULT_BACKDROP_ID),
    [project.assets]
  );

  useEffect(() => {
    if (!addMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (addMenuRef.current && target instanceof HTMLElement && !addMenuRef.current.contains(target)) {
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

  const triggerFileInput = useCallback(
    (multiple: boolean) => {
      if (isElectron() && window.electronAPI?.openFileDialog) {
        window.electronAPI.openFileDialog({ type: assetType, multiple }).then((paths) => {
          paths.forEach((filePath) => {
            const name = filePath.split(/[/\\]/).pop() ?? "Asset";
            addAsset(assetType, name, { path: filePath });
          });
        });
      } else {
        const input = fileInputRef.current;
        if (!input) return;
        input.accept =
          assetType === "sound"
            ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
            : "image/png,image/jpeg,image/gif,image/webp";
        input.multiple = multiple;
        input.onchange = async () => {
          const files = input.files;
          if (!files) return;
          for (const file of Array.from(files)) {
            await addAsset(assetType, file.name, { file });
          }
          input.value = "";
        };
        input.click();
      }
    },
    [addAsset, assetType, fileInputRef]
  );

  const triggerActorImageImport = useCallback(() => {
    if (isElectron() && window.electronAPI?.openFileDialog) {
      window.electronAPI.openFileDialog({ type: "actor", multiple: false }).then((paths) => {
        paths.forEach((filePath) => {
          const name = filePath.split(/[/\\]/).pop() ?? "Actor";
          void addActorFromImage(name, { path: filePath });
        });
      });
    } else {
      const input = fileInputRef.current;
      if (!input) return;
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.multiple = false;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) await addActorFromImage(file.name, { file });
        input.value = "";
      };
      input.click();
    }
  }, [addActorFromImage, fileInputRef]);

  const nextActorName = useCallback(() => {
    const existing = project.assets.filter((asset) => asset.type === "actor").length;
    return existing === 0 ? "New actor" : `New actor ${existing + 1}`;
  }, [project.assets]);

  const triggerReplaceExpression = useCallback(
    (actorId: string, expressionId: string) => {
      replaceExpressionRef.current = { actorId, expressionId };

      if (isElectron() && window.electronAPI?.openFileDialog) {
        window.electronAPI.openFileDialog({ type: "actor", multiple: false }).then((paths) => {
          const filePath = paths[0];
          if (!filePath) return;
          void replaceActorExpressionMedia(actorId, expressionId, { path: filePath });
        });
        return;
      }

      const input = fileInputRef.current;
      if (!input) return;
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.multiple = false;
      input.onchange = () => {
        const file = input.files?.[0];
        const target = replaceExpressionRef.current;
        if (file && target) {
          void replaceActorExpressionMedia(target.actorId, target.expressionId, { file });
        }
        input.value = "";
        replaceExpressionRef.current = null;
      };
      input.click();
    },
    [fileInputRef, replaceActorExpressionMedia]
  );

  const triggerReplaceAsset = useCallback(
    (assetId: string, type: Exclude<AssetType, "actor">) => {
      if (!canReplaceAsset(assetId)) return;

      if (isElectron() && window.electronAPI?.openFileDialog) {
        window.electronAPI.openFileDialog({ type, multiple: false }).then((paths) => {
          const filePath = paths[0];
          if (!filePath) return;
          void replaceAssetMedia(assetId, { path: filePath });
        });
        return;
      }

      replaceAssetRef.current = assetId;
      const input = fileInputRef.current;
      if (!input) return;
      input.accept =
        type === "sound"
          ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
          : "image/png,image/jpeg,image/gif,image/webp";
      input.multiple = false;
      input.onchange = () => {
        const file = input.files?.[0];
        const targetId = replaceAssetRef.current;
        if (file && targetId) {
          void replaceAssetMedia(targetId, { file });
        }
        input.value = "";
        replaceAssetRef.current = null;
      };
      input.click();
    },
    [fileInputRef, replaceAssetMedia]
  );

  const handleDeleteExpression = useCallback(
    (actorId: string, expressionId: string) => {
      try {
        removeActorExpression(actorId, expressionId);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not remove expression");
      }
    },
    [removeActorExpression]
  );

  const startEdit = useCallback(
    (kind: "asset" | "group" | "expression", id: string, name: string, actorId?: string) => {
      if (kind === "asset" && isDefaultBackdrop(id)) return;
      if (kind === "asset") {
        setSelectedAssetId(id);
      } else if (kind === "expression" && actorId) {
        setSelectedAssetId(actorId);
      }
      setEditing({ kind, id, actorId });
      setEditName(name);
    },
    [setSelectedAssetId]
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const trimmed = editName.trim();
    if (editing.kind === "asset") {
      const asset = project.assets.find((entry) => entry.id === editing.id);
      if (asset && trimmed && trimmed !== asset.name) {
        updateAsset(editing.id, { name: trimmed });
      }
    } else if (editing.kind === "group") {
      const group = getAssetGroupsForType(project, assetType).find((entry) => entry.id === editing.id);
      if (group && trimmed && trimmed !== group.name) {
        updateAssetGroup(editing.id, { name: trimmed });
      }
    } else if (editing.kind === "expression" && editing.actorId) {
      const asset = project.assets.find((entry) => entry.id === editing.actorId);
      const expression = asset?.expressions?.find((entry) => entry.id === editing.id);
      if (expression && trimmed && trimmed !== expression.name) {
        updateActorExpression(editing.actorId, editing.id, { name: trimmed });
      }
    }
    setEditing(null);
  }, [assetType, editName, editing, project, updateAsset, updateAssetGroup, updateActorExpression]);

  const handleDeleteAsset = useCallback(
    (assetId: string, name: string) => {
      if (!canRemoveAsset(assetId)) return;
      if (!window.confirm(`Remove asset "${name}"?`)) return;
      removeAsset(assetId);
    },
    [removeAsset]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string, name: string) => {
      if (!window.confirm(`Delete folder "${name}" and move its contents up one level?`)) return;
      removeAssetGroup(groupId);
    },
    [removeAssetGroup]
  );

  const canNestInGroup = useCallback(
    (item: AssetTreeDragItem, targetGroupId: string): boolean => {
      if (item.kind === "expression") return false;
      if (item.kind === "asset") return true;
      if (item.id === targetGroupId) return false;
      const groups = getAssetGroupsForType(project, assetType);
      const descendants = new Set(collectDescendantAssetGroupIds(groups, item.id));
      return !descendants.has(targetGroupId);
    },
    [assetType, project]
  );

  const dropIntoGroup = useCallback(
    (item: AssetTreeDragItem, groupId: string) => {
      if (!canNestInGroup(item, groupId)) return;
      const siblings = getAssetTreeSiblings(project, assetType, groupId).filter(
        (entry) => !(entry.kind === item.kind && entry.id === item.id)
      );
      placeAssetTreeItem(item, {
        assetType,
        parentGroupId: groupId,
        index: siblings.length,
      });
    },
    [assetType, canNestInGroup, placeAssetTreeItem, project]
  );

  const handleDragStart = useCallback((event: React.DragEvent, item: AssetTreeDragItem) => {
    dragItemRef.current = item;
    event.dataTransfer.setData(ASSET_TREE_DRAG_MIME, encodeDragItem(item));
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const getActiveDragItem = useCallback((event: React.DragEvent) => {
    return readDragItem(event.dataTransfer, dragItemRef.current);
  }, []);

  const handleInsertionDragOver = useCallback(
    (event: React.DragEvent, placement: AssetTreePlacement) => {
      const item = getActiveDragItem(event);
      if (!item) return;
      if (item.kind === "expression" && placement.parentActorId !== item.actorId) return;
      if (item.kind !== "expression" && placement.parentActorId) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setInsertionTarget(placement);
      setNestGroupId(null);
    },
    [getActiveDragItem]
  );

  const handleInsertionDrop = useCallback(
    (event: React.DragEvent, placement: AssetTreePlacement) => {
      event.preventDefault();
      event.stopPropagation();
      const item = getActiveDragItem(event);
      clearDragState();
      if (!item) return;
      if (item.kind === "group" && placement.parentGroupId === item.id) return;
      if (
        item.kind === "group" &&
        placement.parentGroupId &&
        !canNestInGroup(item, placement.parentGroupId)
      ) {
        return;
      }
      if (item.kind === "asset" && item.id === DEFAULT_BACKDROP_ID) return;
      placeAssetTreeItem(item, placement);
    },
    [canNestInGroup, clearDragState, getActiveDragItem, placeAssetTreeItem]
  );

  const handleGroupNestDragOver = useCallback(
    (event: React.DragEvent, groupId: string) => {
      const item = getActiveDragItem(event);
      if (!item || !canNestInGroup(item, groupId)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setNestGroupId(groupId);
      setInsertionTarget(null);
    },
    [canNestInGroup, getActiveDragItem]
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

  const renderDragHandle = (item: AssetTreeDragItem, disabled: boolean) => (
    <TreeDragHandle
      disabled={disabled}
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
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(null);
      }}
      className="story-tree-name-input"
    />
  );

  const renderInsertionZone = (placement: AssetTreePlacement, depth: number) => {
    const active =
      insertionTarget !== null && placementKey(insertionTarget) === placementKey(placement);

    return (
      <li
        key={`insert-${placementKey(placement)}`}
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

  const selectAsset = useCallback(
    (assetId: string) => {
      if (canvasDragRef.current) return;
      setSelectedAssetId(assetId);
    },
    [setSelectedAssetId]
  );

  const renderEmptyPlaceholder = () => {
    if (assetType !== "actor" && assetType !== "sound") return null;
    if (hasAssetsOfType) return null;

    const label = assetType === "actor" ? "Add an actor/prop" : "Add a sound clip";
    const handleClick = () => {
      if (assetType === "actor") {
        addBlankActor(nextActorName());
        return;
      }
      triggerFileInput(false);
    };

    return (
      <li key={`empty-${assetType}`} className="story-tree-item">
        <button
          type="button"
          className="story-tree-row story-tree-placeholder-row"
          style={{ paddingLeft: `${treeRowPaddingLeft(0)}px` }}
          onClick={handleClick}
        >
          <TreeToggleSpacer />
          <TreeDragHandle disabled draggable={false} />
          <span className="story-tree-placeholder-label">{label}</span>
        </button>
      </li>
    );
  };

  const renderDefaultBackdropRow = () => {
    if (assetType !== "backdrop" || !defaultBackdrop) return null;
    const selected = selectedAssetId === DEFAULT_BACKDROP_ID;

    return (
      <li key={DEFAULT_BACKDROP_ID} className="story-tree-item">
        <div
          className={`story-tree-row${selected ? " is-selected" : ""}`}
          style={{ paddingLeft: `${treeRowPaddingLeft(0)}px` }}
          onClick={() => selectAsset(DEFAULT_BACKDROP_ID)}
        >
          <TreeToggleSpacer />
          <TreeDragHandle disabled />
          <AssetThumb
            project={project}
            assetId={DEFAULT_BACKDROP_ID}
            assetType="backdrop"
            onCanvasDragStart={() => {
              canvasDragRef.current = true;
            }}
            onCanvasDragEnd={() => {
              window.setTimeout(() => {
                canvasDragRef.current = false;
              }, 0);
            }}
          />
          <span className="story-tree-name story-tree-name-static">Default (required)</span>
          <span
            style={{ display: "inline-flex", gap: "4px", flexShrink: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <ReplaceImageButton
              onClick={() => triggerReplaceAsset(DEFAULT_BACKDROP_ID, "backdrop")}
              title="Replace image…"
            />
          </span>
        </div>
      </li>
    );
  };

  const renderExpressionLevel = (
    actorId: string,
    depth: number,
    expressions: AssetTreeExpressionNode[]
  ) => {
    const elements: JSX.Element[] = [
      renderInsertionZone({ assetType: "actor", parentActorId: actorId, index: 0 }, depth),
    ];

    expressions.forEach((expression, index) => {
      const selected = selectedAssetId === actorId;
      const isEditing =
        editing?.kind === "expression" &&
        editing.id === expression.id &&
        editing.actorId === actorId;
      const label = expression.isDefault ? `${expression.name} (default)` : expression.name;
      const actor = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
      const expressionCount = actor?.expressions?.length ?? 0;
      const usage = getExpressionUsage(project, actorId, expression.id);
      const isLast = expressionCount <= 1;
      const canDelete = usage === 0 && !isLast;
      const deleteTitle = isLast
        ? "An actor must have at least one expression"
        : usage > 0
          ? `Used in ${usage} scene${usage === 1 ? "" : "s"}`
          : "Remove expression";

      elements.push(
        <li key={expression.id} className="story-tree-item">
          <div
            className={`story-tree-row${selected ? " is-selected" : ""}`}
            style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
            onClick={() => selectAsset(actorId)}
          >
            <TreeToggleSpacer />
            {renderDragHandle({ kind: "expression", actorId, id: expression.id }, isEditing)}
            <ExpressionThumb
              project={project}
              actorId={actorId}
              expressionId={expression.id}
              onCanvasDragStart={() => {
                canvasDragRef.current = true;
              }}
              onCanvasDragEnd={() => {
                window.setTimeout(() => {
                  canvasDragRef.current = false;
                }, 0);
              }}
              onSelect={() => selectAsset(actorId)}
            />
            {isEditing ? (
              renderNameEditor()
            ) : (
              <button
                type="button"
                className="story-tree-name"
                onClick={(event) => {
                  event.stopPropagation();
                  startEdit("expression", expression.id, expression.name, actorId);
                }}
              >
                {label}
              </button>
            )}
            <span
              style={{ display: "inline-flex", gap: "4px", flexShrink: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <ReplaceImageButton
                onClick={() => triggerReplaceExpression(actorId, expression.id)}
                title="Replace image…"
              />
              <CloseButton
                onClick={() => handleDeleteExpression(actorId, expression.id)}
                disabled={!canDelete}
                title={deleteTitle}
              />
            </span>
          </div>
        </li>
      );

      elements.push(
        renderInsertionZone({ assetType: "actor", parentActorId: actorId, index: index + 1 }, depth)
      );
    });

    return elements;
  };

  const renderAssetRow = (node: Extract<AssetTreeNode, { kind: "asset" }>, depth: number) => {
    const selected = selectedAssetId === node.id;
    const isEditing = editing?.kind === "asset" && editing.id === node.id;
    const hasExpressions = node.expressions.length > 0;
    const actorExpanded = !collapsedActorIds.has(node.id);

    return (
      <li key={node.id} className="story-tree-item">
        <div
          className={`story-tree-row${selected ? " is-selected" : ""}`}
          style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
          onClick={() => selectAsset(node.id)}
        >
          {node.assetType === "actor" && hasExpressions ? (
            <TreeChevronToggle
              expanded={actorExpanded}
              ariaLabel={actorExpanded ? "Collapse expressions" : "Expand expressions"}
              onClick={(event) => {
                event.stopPropagation();
                setCollapsedActorIds((current) => {
                  const next = new Set(current);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }}
            />
          ) : (
            <TreeToggleSpacer />
          )}
          {renderDragHandle({ kind: "asset", id: node.id }, isEditing)}
          {node.assetType === "actor" ? (
            <span className="story-tree-icon">
              <ActorIcon />
            </span>
          ) : (
            <AssetThumb
              project={project}
              assetId={node.id}
              assetType={node.assetType}
              onCanvasDragStart={() => {
                canvasDragRef.current = true;
              }}
              onCanvasDragEnd={() => {
                window.setTimeout(() => {
                  canvasDragRef.current = false;
                }, 0);
              }}
            />
          )}
          {isEditing ? (
            renderNameEditor()
          ) : (
            <button
              type="button"
              className="story-tree-name"
              onClick={(event) => {
                event.stopPropagation();
                startEdit("asset", node.id, node.name);
              }}
            >
              {node.name}
            </button>
          )}
          {(canReplaceAsset(node.id) && node.assetType !== "actor") || canRemoveAsset(node.id) ? (
            <span
              style={{ display: "inline-flex", gap: "4px", flexShrink: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              {canReplaceAsset(node.id) && node.assetType !== "actor" && (
                <ReplaceImageButton
                  onClick={() => triggerReplaceAsset(node.id, node.assetType)}
                  title={node.assetType === "sound" ? "Replace audio…" : "Replace image…"}
                />
              )}
              {canRemoveAsset(node.id) && (
                <CloseButton
                  title="Remove asset"
                  onClick={() => handleDeleteAsset(node.id, node.name)}
                />
              )}
            </span>
          ) : null}
        </div>
        {hasExpressions && actorExpanded && (
          <ul className="story-tree-list">
            {renderExpressionLevel(node.id, depth + 1, node.expressions)}
          </ul>
        )}
      </li>
    );
  };

  const renderLevel = (
    parentGroupId: string | undefined,
    depth: number,
    nodes: AssetTreeNode[]
  ) => {
    const elements: JSX.Element[] = [
      renderInsertionZone({ assetType, parentGroupId, index: 0 }, depth),
    ];

    nodes.forEach((node, index) => {
      if (node.kind === "asset") {
        elements.push(renderAssetRow(node, depth));
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
                  setCollapsedGroupIds((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
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

      elements.push(renderInsertionZone({ assetType, parentGroupId, index: index + 1 }, depth));
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
          <span>{sectionTitle(assetType)}</span>
        </button>
        <div ref={addMenuRef} style={{ position: "relative" }}>
          <AddButton
            onClick={() => setAddMenuOpen((open) => !open)}
            title={`Add ${sectionTitle(assetType).toLowerCase()} item`}
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
                minWidth: "160px",
              }}
            >
              {assetType === "backdrop" && (
                <button
                  type="button"
                  className="app-context-menu-item"
                  onClick={() => {
                    triggerFileInput(false);
                    setAddMenuOpen(false);
                  }}
                >
                  Add Backdrop
                </button>
              )}
              {assetType === "actor" && (
                <>
                  <button
                    type="button"
                    className="app-context-menu-item"
                    onClick={() => {
                      addBlankActor(nextActorName());
                      setAddMenuOpen(false);
                    }}
                  >
                    Add Actor
                  </button>
                  <button
                    type="button"
                    className="app-context-menu-item"
                    onClick={() => {
                      triggerActorImageImport();
                      setAddMenuOpen(false);
                    }}
                  >
                    Import Image…
                  </button>
                </>
              )}
              {assetType === "sound" && (
                <button
                  type="button"
                  className="app-context-menu-item"
                  onClick={() => {
                    triggerFileInput(false);
                    setAddMenuOpen(false);
                  }}
                >
                  Add Sound Clip
                </button>
              )}
              <button
                type="button"
                className="app-context-menu-item"
                onClick={() => {
                  addAssetGroup(assetType);
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
        <ul className="story-tree-list story-tree-root">
          {renderDefaultBackdropRow()}
          {!hasAssetsOfType && tree.length === 0
            ? renderEmptyPlaceholder()
            : renderLevel(undefined, 0, tree)}
          {!hasAssetsOfType && tree.length > 0 && renderEmptyPlaceholder()}
        </ul>
      )}
    </div>
  );
}

export function AssetTreeView() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="asset-tree">
      <input ref={fileInputRef} type="file" style={{ display: "none" }} accept="image/*,audio/*" />
      <AssetTreeSection assetType="backdrop" fileInputRef={fileInputRef} />
      <AssetTreeSection assetType="actor" fileInputRef={fileInputRef} />
      <AssetTreeSection assetType="sound" fileInputRef={fileInputRef} />
    </div>
  );
}
