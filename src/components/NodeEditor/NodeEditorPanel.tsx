import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import type { MutationOptions } from "@/store/projectStore";
import type { Project, SoundConfig, StoryNode, ActorSceneConfig } from "@/core/model/types";
import { getNodeDisplayName, isNodeLabelUnique } from "@/core/model/nodeNames";
import { getStartNodes, isJumpNode, isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import { getNodeSpeakerForLocale, getNodeTextTemplateForLocale } from "@/core/locale/prompts";
import { getAssetDragData, isAssetDrag } from "@/utils/dragDrop";
import { patchNodeForAssetDrop } from "@/core/assets/applyAssetToNode";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { useActorExpressionUrl } from "@/hooks/useActorExpressionUrl";
import { DEFAULT_BACKDROP_ID } from "@/core/assets/defaultBackdrop";
import { AddButton } from "../AddButton";
import { CloseButton } from "../CloseButton";
import { LocaleVisibilityToggle } from "../LocaleVisibilityToggle";
import { TemplateTextEditor } from "./TemplateTextEditor";
import { InspectorPanelId } from "../InspectorPanelMeta";

const ACTOR_THUMB_SIZE = 36;
const NODE_ACTOR_DRAG_TYPE = "application/x-muselab-node-actor-index";

function NodeNameField({
  node,
  story,
  update,
  onFocus,
  onBlur,
  placeholder,
}: {
  node: StoryNode;
  story: ReturnType<typeof useActiveStory>["story"];
  update: (patch: Partial<Omit<StoryNode, "id">>, options?: MutationOptions) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <label style={{ display: "block", marginBottom: "8px" }}>
      Name
      <input
        type="text"
        value={node.label ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          const trimmed = value.trim();
          if (trimmed && !isNodeLabelUnique(story, trimmed, node.id)) {
            setError("Name must be unique within this story");
            return;
          }
          setError(null);
          update({ label: value || undefined }, { mergeKey: `node-label:${node.id}` });
        }}
        onFocus={onFocus}
        onBlur={() => {
          onBlur?.();
          if (!node.label?.trim()) {
            setError(null);
          }
        }}
        placeholder={placeholder ?? getNodeDisplayName(node)}
        style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
      />
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
          {error}
        </p>
      )}
    </label>
  );
}

function SoundConfigRow({
  config,
  soundAssetIds,
  onChange,
  onRemove,
  onSelectFocus,
}: {
  config: SoundConfig;
  soundAssetIds: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<SoundConfig>) => void;
  onRemove: () => void;
  onSelectFocus: () => void;
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
          onFocus={onSelectFocus}
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
  config,
  name,
  index,
  onRemove,
  onExpressionChange,
  onReorderDrop,
  onReorderDragOver,
  onReorderDragLeave,
  isDropTarget,
  onFocusPreview,
}: {
  project: Project;
  config: ActorSceneConfig;
  name: string;
  index: number;
  onRemove: () => void;
  onExpressionChange: (expressionId: string) => void;
  onReorderDrop: (fromIndex: number, toIndex: number) => void;
  onReorderDragOver: () => void;
  onReorderDragLeave: () => void;
  isDropTarget: boolean;
  onFocusPreview: () => void;
}) {
  const actor = project.assets.find((asset) => asset.id === config.assetId && asset.type === "actor");
  const expressions = actor?.expressions ?? [];
  const thumbUrl = useActorExpressionUrl(project, config.assetId, config.expressionId);

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
      tabIndex={0}
      onFocus={onFocusPreview}
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
      <select
        value={config.expressionId}
        onChange={(e) => onExpressionChange(e.target.value)}
        onFocus={onFocusPreview}
        style={{ maxWidth: "96px", fontSize: "11px" }}
      >
        {expressions.map((expression) => (
          <option key={expression.id} value={expression.id}>
            {expression.name}
          </option>
        ))}
      </select>
      <CloseButton onClick={onRemove} title="Remove actor" />
    </div>
  );
}

export function NodeEditorPanel() {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const { story, storyId } = useActiveStory();
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateNode = useProjectStore((s) => s.updateNode);
  const updateNodePrompt = useProjectStore((s) => s.updateNodePrompt);
  const updateNodeSpeaker = useProjectStore((s) => s.updateNodeSpeaker);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const showPreview = useSceneEditorPreviewStore((s) => s.showPreview);
  const updateDraftTemplate = useSceneEditorPreviewStore((s) => s.updateDraftTemplate);
  const previewLocale = useSceneEditorPreviewStore((s) => s.locale);

  const node =
    selectedNodeIds.length === 1
      ? story.nodes.find((n) => n.id === selectedNodeIds[0])
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
  const [visibleLocales, setVisibleLocales] = useState<string[]>(project.locales);

  useEffect(() => {
    setVisibleLocales(project.locales);
  }, [project.locales]);

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
        const patch = patchNodeForAssetDrop(project, node, data);
        if (patch) update(patch);
      }
    },
    [node, project, update]
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
        const patch = patchNodeForAssetDrop(project, node, data);
        if (patch) update(patch);
      }
    },
    [node, project, update]
  );

  const reorderActors = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!node) return;
      const configs = [...(node.actorConfigs ?? [])];
      if (fromIndex < 0 || fromIndex >= configs.length || toIndex < 0 || toIndex >= configs.length) return;
      const [removed] = configs.splice(fromIndex, 1);
      configs.splice(toIndex, 0, removed);
      update({ actorConfigs: configs });
      setActorReorderDropIndex(null);
    },
    [node, project, update]
  );

  const openScenePreview = useCallback(() => {
    showPreview();
  }, [showPreview]);

  const openScenePreviewForLocale = useCallback(
    (locale: string) => {
      showPreview({ locale });
    },
    [showPreview]
  );

  const openScenePreviewForPrompt = useCallback(
    (locale: string) => {
      if (!node) return;
      showPreview({
        locale,
        draftTemplate: getNodeTextTemplateForLocale(promptsByLocale, locale, storyId, node.id),
      });
    },
    [node, promptsByLocale, showPreview, storyId]
  );

  const handlePromptDraftChange = useCallback(
    (locale: string, draft: string) => {
      if (previewLocale === locale) {
        updateDraftTemplate(draft);
      }
    },
    [previewLocale, updateDraftTemplate]
  );

  if (!node) return null;

  if (isStartNode(node)) {
    return (
      <div className="app-inspector-panel-body">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <strong>Start</strong>
          <CloseButton onClick={() => clearSelection()} />
        </div>
        <InspectorPanelId id={node.id} />
        <NodeNameField
          node={node}
          story={story}
          update={update}
          onBlur={() => flushHistoryCoalesce()}
          placeholder="Start"
        />
      </div>
    );
  }

  if (isJumpNode(node)) {
    const targetStoryId = node.jumpTargetStoryId ?? storyId;
    const targetStory = project.stories.find((entry) => entry.id === targetStoryId);
    const targetStarts = targetStory ? getStartNodes(targetStory) : [];

    return (
      <div className="app-inspector-panel-body">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <strong>Jump To</strong>
          <CloseButton onClick={() => clearSelection()} />
        </div>
        <InspectorPanelId id={node.id} />
        <NodeNameField
          node={node}
          story={story}
          update={update}
          onBlur={() => flushHistoryCoalesce()}
          placeholder="Jump To"
        />
        <label style={{ display: "block", marginBottom: "8px" }}>
          Target story
          <select
            value={targetStoryId}
            onChange={(e) => {
              const nextStoryId = e.target.value;
              const nextStory = project.stories.find((entry) => entry.id === nextStoryId);
              const firstStart = nextStory ? getStartNodes(nextStory)[0] : undefined;
              update({
                jumpTargetStoryId: nextStoryId,
                jumpTargetStartNodeId: firstStart?.id,
              });
            }}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
          >
            {project.stories.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Target Start
          <select
            value={node.jumpTargetStartNodeId ?? ""}
            onChange={(e) =>
              update({
                jumpTargetStoryId: targetStoryId,
                jumpTargetStartNodeId: e.target.value || undefined,
              })
            }
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
          >
            <option value="">— Select Start —</option>
            {targetStarts.map((startNode) => (
              <option key={startNode.id} value={startNode.id}>
                {getNodeDisplayName(startNode)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (!isSceneNode(node)) return null;

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

  const removeActor = (assetId: string) => {
    update({ actorConfigs: (node.actorConfigs ?? []).filter((config) => config.assetId !== assetId) });
  };

  const updateActorExpression = (assetId: string, expressionId: string) => {
    update({
      actorConfigs: (node.actorConfigs ?? []).map((config) =>
        config.assetId === assetId ? { ...config, expressionId } : config
      ),
    });
  };

  const currentBackdrop =
    backdrops.find((a) => a.id === node.backdropId) ??
    backdrops.find((a) => a.id === DEFAULT_BACKDROP_ID);

  return (
    <div className="app-inspector-panel-body">
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

      <InspectorPanelId id={node.id} />
      <NodeNameField
        node={node}
        story={story}
        update={update}
        onFocus={openScenePreview}
        onBlur={() => flushHistoryCoalesce()}
        placeholder="Scene"
      />

      <div style={{ marginBottom: "8px" }}>
        <div style={{ marginBottom: "4px" }}>Backdrop</div>
        <div
          tabIndex={0}
          onFocus={openScenePreview}
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
          {(node.actorConfigs ?? []).length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setActorReorderDropIndex(null);
              }}
            >
              {(node.actorConfigs ?? []).map((config, index) => {
                const actor = actors.find((a) => a.id === config.assetId);
                return (
                  <ActorRow
                    key={config.assetId}
                    project={project}
                    config={config}
                    name={actor?.name ?? config.assetId}
                    index={index}
                    onRemove={() => removeActor(config.assetId)}
                    onExpressionChange={(expressionId) => updateActorExpression(config.assetId, expressionId)}
                    onReorderDrop={reorderActors}
                    onReorderDragOver={() => setActorReorderDropIndex(index)}
                    onReorderDragLeave={() => setActorReorderDropIndex(null)}
                    isDropTarget={actorReorderDropIndex === index}
                    onFocusPreview={openScenePreview}
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
            onSelectFocus={openScenePreview}
          />
        ))}
      </div>

      <div style={{ marginBottom: "8px" }}>
        <LocaleVisibilityToggle
          locales={project.locales}
          visibleLocales={visibleLocales}
          onChange={setVisibleLocales}
        />
        {visibleLocales.map((locale) => (
          <div key={locale} style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              <div style={{ marginBottom: "4px" }}>Speaker ({locale})</div>
              <input
                type="text"
                value={getNodeSpeakerForLocale(promptsByLocale, locale, storyId, node.id)}
                onChange={(e) =>
                  updateNodeSpeaker(locale, node.id, e.target.value, {
                    mergeKey: `node-speaker:${node.id}:${locale}`,
                  })
                }
                onFocus={() => openScenePreviewForLocale(locale)}
                placeholder="Optional — supports Cito, e.g. {{ rt.GetString('name') }}"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <div style={{ marginBottom: "4px" }}>Text template ({locale})</div>
              <TemplateTextEditor
                value={getNodeTextTemplateForLocale(promptsByLocale, locale, storyId, node.id)}
                onChange={(markup) =>
                  updateNodePrompt(locale, node.id, markup, {
                    mergeKey: `node-text:${node.id}:${locale}`,
                  })
                }
                onFocus={() => openScenePreviewForPrompt(locale)}
                onDraftChange={(draft) => handlePromptDraftChange(locale, draft)}
                onBlurCommit={() => flushHistoryCoalesce()}
                syncKey={`${node.id}:${locale}`}
                placeholder='Hello world… Use the toolbar for Format.* tags, or {{ rt.GetString("key") }} for logic.'
                style={{ marginTop: "4px", width: "100%" }}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
