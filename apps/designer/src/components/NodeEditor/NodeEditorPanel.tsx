import { useCallback, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import type { MutationOptions } from "@/store/projectStore";
import type { NodePatch } from "@/core/events/types";
import type { Attributes, SoundConfig, StoryNode } from "@/core/model/types";
import type { SceneAction } from "@/core/scene/actions";
import { getNodeDisplayName, isNodeLabelUnique } from "@/core/model/nodeNames";
import { getStartNodes, isJumpNode, isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import { getDefaultLocale, getNodeActionsForLocale } from "@/core/locale/prompts";
import { summarizeSceneActions } from "@/core/scene/sceneSummary";
import { AddButton } from "../AddButton";
import { CloseButton } from "../CloseButton";
import { EditButton } from "../EditButton";
import { ViewButton } from "../ViewButton";
import { InspectorPanelHeader, InspectorPanelId } from "../InspectorPanelMeta";
import { AttributesEditor } from "../AttributesEditor/AttributesEditor";

function PromptSoundIcon() {
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

function PromptLocaleRow({
  locale,
  displayName,
  actions,
  onView,
  onEdit,
}: {
  locale: string;
  displayName: string;
  actions: SceneAction[];
  onView: () => void;
  onEdit: () => void;
}) {
  const summary = summarizeSceneActions(actions);
  const charCount = summary.previewText.length;
  const hasSound = actions.some((action) => action.kind === "playSound");
  const speakerLabel = summary.speaker.trim();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        border: "1px solid var(--app-border-subtle)",
        borderRadius: "6px",
        background: "var(--app-surface)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: "13px",
        }}
        title={locale}
      >
        {displayName}
      </span>
      <span style={{ flex: 1, minWidth: 0 }} aria-hidden />
      {speakerLabel.length > 0 && (
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "999px",
            background: "var(--app-surface-hover)",
            border: "1px solid var(--app-border-subtle)",
            color: "var(--app-text-muted)",
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 1,
            minWidth: 0,
          }}
          title={speakerLabel}
        >
          {speakerLabel}
        </span>
      )}
      <span
        style={{
          width: "16px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--app-text-muted)",
          flexShrink: 0,
        }}
        title={hasSound ? "Contains PlaySound or PlaySoundClip" : undefined}
        aria-hidden={!hasSound}
      >
        {hasSound ? <PromptSoundIcon /> : null}
      </span>
      <span
        style={{
          fontSize: "12px",
          color: "var(--app-text-muted)",
          minWidth: "2.5ch",
          textAlign: "right",
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
        title="Dialogue characters in this scene"
      >
        {charCount}
      </span>
      <ViewButton onClick={onView} title={`View ${locale} prompt`} />
      <EditButton onClick={onEdit} title={`Edit ${locale} prompt`} />
    </div>
  );
}

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
  update: (patch: NodePatch, options?: MutationOptions) => void;
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
  index,
  nodeId,
  soundAssetIds,
  onChange,
  onAttributesChange,
  onRemove,
  onSelectFocus,
  flushHistoryCoalesce,
}: {
  config: SoundConfig;
  index: number;
  nodeId: string;
  soundAssetIds: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<SoundConfig>) => void;
  onAttributesChange: (attributes: Attributes | undefined, mergeKey: string) => void;
  onRemove: () => void;
  onSelectFocus: () => void;
  flushHistoryCoalesce: () => void;
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
      <AttributesEditor
        title="Sound attributes"
        attributes={config.attributes}
        onChange={onAttributesChange}
        mergeKeyPrefix={`attribute:node:${nodeId}:sound:${index}`}
        flushHistoryCoalesce={flushHistoryCoalesce}
        compact
      />
    </div>
  );
}

function NodeAttributesSection({
  nodeId,
  attributes,
  onChange,
  flushHistoryCoalesce,
}: {
  nodeId: string;
  attributes: Attributes | undefined;
  onChange: (attributes: Attributes | undefined, mergeKey: string) => void;
  flushHistoryCoalesce: () => void;
}) {
  return (
    <AttributesEditor
      attributes={attributes}
      onChange={onChange}
      mergeKeyPrefix={`attribute:node:${nodeId}`}
      flushHistoryCoalesce={flushHistoryCoalesce}
    />
  );
}

export function NodeEditorPanel() {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const { story, storyId } = useActiveStory();
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateNode = useProjectStore((s) => s.updateNode);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const showPreview = useSceneEditorPreviewStore((s) => s.showPreview);
  const showActionEditor = useSceneEditorPreviewStore((s) => s.showActionEditor);

  const node =
    selectedNodeIds.length === 1
      ? story.nodes.find((n) => n.id === selectedNodeIds[0])
      : null;

  const sounds = project.assets.filter((a) => a.type === "sound");

  const update = useCallback(
    (patch: NodePatch, options?: MutationOptions) => {
      if (node) updateNode(node.id, patch, options);
    },
    [node, updateNode]
  );

  const openScenePreview = useCallback(() => {
    showPreview({ locale: getDefaultLocale(project) });
  }, [project, showPreview]);

  const openPromptView = useCallback(
    (locale: string) => {
      showPreview({ locale, editingActions: false });
    },
    [showPreview]
  );

  const openActionEditor = useCallback(
    (locale: string) => {
      showActionEditor(locale);
    },
    [showActionEditor]
  );

  if (!node) return null;

  if (isStartNode(node)) {
    return (
      <div className="app-inspector-panel-body">
        <InspectorPanelHeader title="Start" onClose={() => clearSelection()} />
        <InspectorPanelId id={node.id} />
        <NodeNameField
          node={node}
          story={story}
          update={update}
          onBlur={() => flushHistoryCoalesce()}
          placeholder="Start"
        />
        <NodeAttributesSection
          nodeId={node.id}
          attributes={node.attributes}
          onChange={(next, mergeKey) => update({ attributes: next ?? null }, { mergeKey })}
          flushHistoryCoalesce={flushHistoryCoalesce}
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
        <InspectorPanelHeader title="Jump To" onClose={() => clearSelection()} />
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
        <NodeAttributesSection
          nodeId={node.id}
          attributes={node.attributes}
          onChange={(next, mergeKey) => update({ attributes: next ?? null }, { mergeKey })}
          flushHistoryCoalesce={flushHistoryCoalesce}
        />
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

  const updateSoundAttributes = (
    index: number,
    attributes: Attributes | undefined,
    mergeKey: string
  ) => {
    const soundConfigs = [...(node.soundConfigs || [])];
    const next = { ...soundConfigs[index] };
    if (attributes) {
      next.attributes = attributes;
    } else {
      delete next.attributes;
    }
    soundConfigs[index] = next;
    update({ soundConfigs }, { mergeKey });
  };

  return (
    <div className="app-inspector-panel-body">
      <InspectorPanelHeader title="Scene" onClose={() => clearSelection()} />

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span>Sounds</span>
          <AddButton onClick={addSoundConfig} title="Add sound" />
        </div>
        {(node.soundConfigs ?? []).map((config, i) => (
          <SoundConfigRow
            key={i}
            config={config}
            index={i}
            nodeId={node.id}
            soundAssetIds={sounds.map((a) => ({ id: a.id, name: a.name }))}
            onChange={(patch) => updateSoundConfig(i, patch)}
            onAttributesChange={(next, mergeKey) => updateSoundAttributes(i, next, mergeKey)}
            onRemove={() => removeSoundConfig(i)}
            onSelectFocus={openScenePreview}
            flushHistoryCoalesce={flushHistoryCoalesce}
          />
        ))}
      </div>

      <div style={{ marginBottom: "8px" }}>
        <div style={{ marginBottom: "4px" }}>Scene script</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {project.locales.map((entry) => (
            <PromptLocaleRow
              key={entry.id}
              locale={entry.locale}
              displayName={entry.displayName}
              actions={getNodeActionsForLocale(promptsByLocale, entry.locale, storyId, node.id)}
              onView={() => openPromptView(entry.locale)}
              onEdit={() => openActionEditor(entry.locale)}
            />
          ))}
        </div>
      </div>

      <NodeAttributesSection
        nodeId={node.id}
        attributes={node.attributes}
        onChange={(next, mergeKey) => update({ attributes: next ?? null }, { mergeKey })}
        flushHistoryCoalesce={flushHistoryCoalesce}
      />
    </div>
  );
}
