import { useCallback, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { MutationOptions } from "@/store/projectStore";
import type { Project, SoundConfig, StoryNode } from "@/core/model/types";
import { getAssetDragData, isAssetDrag } from "@/utils/dragDrop";
import { patchNodeForAssetDrop } from "@/core/assets/applyAssetToNode";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { DEFAULT_BACKDROP_ID } from "@/core/assets/defaultBackdrop";
import { AddButton } from "../AddButton";
import { CloseButton } from "../CloseButton";
import { TemplateTextEditor } from "./TemplateTextEditor";

const ACTOR_THUMB_SIZE = 36;
const NODE_ACTOR_DRAG_TYPE = "application/x-muselab-node-actor-index";

function SoundConfigRow({
  config,
  soundAssetIds,
  onChange,
  onRemove,
}: {
  config: SoundConfig;
  soundAssetIds: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<SoundConfig>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--app-border-subtle)",
        borderRadius: "6px",
        padding: "8px",
        marginBottom: "8px",
        background: "var(--app-surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <select
          value={config.assetId}
          onChange={(e) => onChange({ assetId: e.target.value })}
          style={{ flex: 1, marginRight: "8px" }}
        >
          <option value="">— Select sound —</option>
          {soundAssetIds.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <CloseButton onClick={onRemove} title="Remove" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px" }}>
        <label>
          <input
            type="checkbox"
            checked={!!config.startOnLoad}
            onChange={(e) => onChange({ startOnLoad: e.target.checked })}
          />{" "}
          Start on load
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!config.stopOnLoad}
            onChange={(e) => onChange({ stopOnLoad: e.target.checked })}
          />{" "}
          Stop on load
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!config.loop}
            onChange={(e) => onChange({ loop: e.target.checked })}
          />{" "}
          Loop
        </label>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        <label style={{ flex: 1 }}>
          Start (s):{" "}
          <input
            type="number"
            min={0}
            step={0.1}
            value={config.startTime ?? ""}
            onChange={(e) =>
              onChange({
                startTime: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={{ width: "60px" }}
          />
        </label>
        <label style={{ flex: 1 }}>
          End (s):{" "}
          <input
            type="number"
            min={0}
            step={0.1}
            value={config.endTime ?? ""}
            onChange={(e) =>
              onChange({
                endTime: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={{ width: "60px" }}
          />
        </label>
      </div>
    </div>
  );
}

function ActorRow({
  project,
  actorId,
  name,
  index,
  onRemove,
  onReorderDrop,
  onReorderDragOver,
  onReorderDragLeave,
  isDropTarget,
}: {
  project: Project;
  actorId: string;
  name: string;
  index: number;
  onRemove: () => void;
  onReorderDrop: (fromIndex: number, toIndex: number) => void;
  onReorderDragOver: () => void;
  onReorderDragLeave: () => void;
  isDropTarget: boolean;
}) {
  const thumbUrl = useAssetUrl(project, actorId);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(NODE_ACTOR_DRAG_TYPE, String(index));
      e.dataTransfer.effectAllowed = "move";
    },
    [index]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(NODE_ACTOR_DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onReorderDragOver();
      }
    },
    [onReorderDragOver]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(NODE_ACTOR_DRAG_TYPE);
      if (raw === "") return;
      const fromIndex = parseInt(raw, 10);
      if (Number.isNaN(fromIndex) || fromIndex === index) return;
      e.preventDefault();
      onReorderDrop(fromIndex, index);
    },
    [index, onReorderDrop]
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onReorderDragLeave}
      onDrop={onDrop}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        padding: "4px 6px",
        borderRadius: "6px",
        background: isDropTarget ? "var(--app-accent-soft)" : "transparent",
        cursor: "grab",
      }}
    >
      <div
        style={{
          width: ACTOR_THUMB_SIZE,
          height: ACTOR_THUMB_SIZE,
          flexShrink: 0,
          borderRadius: "4px",
          overflow: "hidden",
          background: "var(--app-border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span style={{ fontSize: "10px", color: "var(--app-text-subtle)" }}>…</span>
        )}
      </div>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>
        {name}
      </span>
      <CloseButton onClick={onRemove} title="Remove actor" />
    </div>
  );
}

export function NodeEditorPanel() {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const project = useProjectStore((s) => s.project);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateNode = useProjectStore((s) => s.updateNode);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);

  const node =
    selectedNodeIds.length === 1
      ? project.nodes.find((n) => n.id === selectedNodeIds[0])
      : null;

  const backdrops = project.assets.filter((a) => a.type === "backdrop");
  const actors = project.assets.filter((a) => a.type === "actor");
  const sounds = project.assets.filter((a) => a.type === "sound");

  const backdropUrl = useAssetUrl(project, node?.backdropId ?? DEFAULT_BACKDROP_ID);

  const update = useCallback(
    (patch: Partial<Omit<StoryNode, "id">>, options?: MutationOptions) => {
      if (node) updateNode(node.id, patch, options);
    },
    [node, updateNode]
  );

  const [backdropDropActive, setBackdropDropActive] = useState(false);
  const [actorsDropActive, setActorsDropActive] = useState(false);
  const [actorReorderDropIndex, setActorReorderDropIndex] = useState<number | null>(null);

  const onBackdropDragOver = useCallback((e: React.DragEvent) => {
    if (isAssetDrag(e.dataTransfer)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setBackdropDropActive(true);
    }
  }, []);

  const onBackdropDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setBackdropDropActive(false);
  }, []);

  const onBackdropDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setBackdropDropActive(false);
      const data = getAssetDragData(e.dataTransfer);
      if (data?.type === "backdrop" && node) {
        const patch = patchNodeForAssetDrop(node, data);
        if (patch) update(patch);
      }
    },
    [node, update]
  );

  const onActorsDragOver = useCallback((e: React.DragEvent) => {
    if (isAssetDrag(e.dataTransfer)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setActorsDropActive(true);
    }
  }, []);

  const onActorsDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setActorsDropActive(false);
  }, []);

  const onActorsDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setActorsDropActive(false);
      const data = getAssetDragData(e.dataTransfer);
      if (data?.type === "actor" && node) {
        const patch = patchNodeForAssetDrop(node, data);
        if (patch) update(patch);
      }
    },
    [node, update]
  );

  const reorderActors = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!node) return;
      const ids = [...(node.actorIds ?? [])];
      if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return;
      const [removed] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, removed);
      update({ actorIds: ids });
      setActorReorderDropIndex(null);
    },
    [node, update]
  );

  if (!node) return null;

  const addSoundConfig = () => {
    const soundConfigs = [...(node.soundConfigs || [])];
    soundConfigs.push({
      assetId: sounds[0]?.id ?? "",
      startOnLoad: false,
      stopOnLoad: false,
      loop: false,
    });
    update({ soundConfigs });
  };

  const updateSoundConfig = (index: number, patch: Partial<SoundConfig>) => {
    const soundConfigs = [...(node.soundConfigs || [])];
    soundConfigs[index] = { ...soundConfigs[index], ...patch };
    update({ soundConfigs });
  };

  const removeSoundConfig = (index: number) => {
    const soundConfigs = node.soundConfigs?.filter((_, i) => i !== index) ?? [];
    update({ soundConfigs });
  };

  const removeActor = (actorId: string) => {
    update({ actorIds: (node.actorIds ?? []).filter((id) => id !== actorId) });
  };

  const currentBackdrop =
    backdrops.find((a) => a.id === node.backdropId) ??
    backdrops.find((a) => a.id === DEFAULT_BACKDROP_ID);

  return (
    <div
      style={{
        width: "320px",
        borderLeft: "1px solid var(--app-border)",
        padding: "12px",
        background: "var(--app-surface-muted)",
        overflowY: "auto",
        maxHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <strong>Scene</strong>
        <CloseButton onClick={() => clearSelection()} />
      </div>

      <label style={{ display: "block", marginBottom: "8px" }}>
        Scene Title
        <input
          type="text"
          value={node.label ?? ""}
          onChange={(e) =>
            update({ label: e.target.value || undefined }, { mergeKey: `node-label:${node.id}` })
          }
          onBlur={() => flushHistoryCoalesce()}
          placeholder="Scene name"
          style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
        />
      </label>

      <div style={{ marginBottom: "8px" }}>
        <div style={{ marginBottom: "4px" }}>Backdrop</div>
        <div
          onDragOver={onBackdropDragOver}
          onDragLeave={onBackdropDragLeave}
          onDrop={onBackdropDrop}
          style={{
            marginTop: "4px",
            minHeight: "56px",
            border: `2px dashed ${backdropDropActive ? "var(--app-accent-border)" : "var(--app-border)"}`,
            borderRadius: "8px",
            background: backdropDropActive ? "var(--app-accent-soft-bg)" : "var(--app-surface-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {currentBackdrop ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px" }}>
              {backdropUrl ? (
                <img
                  src={backdropUrl}
                  alt=""
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "4px",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "var(--app-border-subtle)",
                    borderRadius: "4px",
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ flex: 1, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentBackdrop.name}
              </span>
              {node.backdropId !== DEFAULT_BACKDROP_ID && (
                <button
                  type="button"
                  onClick={() => update({ backdropId: DEFAULT_BACKDROP_ID })}
                  title="Use default backdrop"
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    border: "1px solid var(--app-border)",
                    borderRadius: "4px",
                    background: "var(--app-surface)",
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--app-text-subtle)" }}>
              {backdropDropActive ? "Drop here" : "Drop backdrop from Assets"}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <div style={{ marginBottom: "4px" }}>Actors</div>
        <div
          onDragOver={onActorsDragOver}
          onDragLeave={onActorsDragLeave}
          onDrop={onActorsDrop}
          style={{
            minHeight: "48px",
            border: `2px dashed ${actorsDropActive ? "var(--app-accent-border)" : "var(--app-border)"}`,
            borderRadius: "8px",
            background: actorsDropActive ? "var(--app-accent-soft-bg)" : "var(--app-surface-muted)",
            padding: "8px",
          }}
        >
          {(node.actorIds ?? []).length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setActorReorderDropIndex(null);
              }}
            >
              {(node.actorIds ?? []).map((actorId, index) => {
                const actor = actors.find((a) => a.id === actorId);
                return (
                  <ActorRow
                    key={actorId}
                    project={project}
                    actorId={actorId}
                    name={actor?.name ?? actorId}
                    index={index}
                    onRemove={() => removeActor(actorId)}
                    onReorderDrop={reorderActors}
                    onReorderDragOver={() => setActorReorderDropIndex(index)}
                    onReorderDragLeave={() => setActorReorderDropIndex(null)}
                    isDropTarget={actorReorderDropIndex === index}
                  />
                );
              })}
              <span style={{ fontSize: "11px", color: "var(--app-text-subtle)", marginTop: "4px" }}>
                Drag to reorder · Drop another actor from Assets
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--app-text-subtle)", display: "block", textAlign: "center" }}>
              {actorsDropActive ? "Drop here" : "Drop actors from Assets"}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span>Sounds</span>
          <AddButton onClick={addSoundConfig} title="Add sound" />
        </div>
        {(node.soundConfigs ?? []).map((config, i) => (
          <SoundConfigRow
            key={i}
            config={config}
            soundAssetIds={sounds.map((a) => ({ id: a.id, name: a.name }))}
            onChange={(patch) => updateSoundConfig(i, patch)}
            onRemove={() => removeSoundConfig(i)}
          />
        ))}
      </div>

      <label style={{ display: "block", marginBottom: "8px" }}>
        <div style={{ marginBottom: "4px" }}>Text template</div>
        <TemplateTextEditor
          value={node.textTemplate}
          onChange={(markup) =>
            update({ textTemplate: markup }, { mergeKey: `node-text:${node.id}` })
          }
          onBlurCommit={() => flushHistoryCoalesce()}
          syncKey={node.id}
          placeholder="Hello world… Use the toolbar for style tags, or {{ state.x }} for logic."
          style={{ marginTop: "4px", width: "100%" }}
        />
      </label>
    </div>
  );
}
