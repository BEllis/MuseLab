import { useProjectStore } from "@/store/projectStore";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { getPlayValidationMessage } from "@/core/model/playValidationMessage";
import { getNodeDisplayName } from "@/core/model/nodeNames";
import { countSceneNodes, getStartNodes } from "@/core/model/nodeTypes";
import { AttributesEditor } from "../AttributesEditor/AttributesEditor";
import { InspectorPanelHeader, InspectorPanelId } from "../InspectorPanelMeta";

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        fontSize: "12px",
        marginBottom: "4px",
      }}
    >
      <span style={{ color: "var(--app-text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function StoryEditorPanel() {
  const selectedStoryId = useProjectStore((s) => s.selectedStoryId);
  const project = useProjectStore((s) => s.project);
  const setSelectedStoryId = useProjectStore((s) => s.setSelectedStoryId);
  const updateStory = useProjectStore((s) => s.updateStory);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);

  const story = selectedStoryId
    ? project.stories.find((entry) => entry.id === selectedStoryId)
    : undefined;

  if (!story) return null;

  const validation = validatePlayEntry(story);
  const startNodes = getStartNodes(story);

  return (
    <div className="app-inspector-panel-body">
      <InspectorPanelHeader title="Story" onClose={() => setSelectedStoryId(null)} />

      <InspectorPanelId id={story.id} />

      <label style={{ display: "block", marginBottom: "12px", fontSize: "12px" }}>
        Name
        <input
          type="text"
          value={story.name}
          readOnly
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            opacity: 0.85,
          }}
        />
      </label>

      <div style={{ marginBottom: "16px" }}>
        <strong style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Summary</strong>
        <StatRow label="Scenes" value={countSceneNodes(story)} />
        <StatRow label="Links" value={story.edges.length} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>
          <strong>Start at</strong>
          <select
            value={story.entryNodeId ?? ""}
            onChange={(e) =>
              updateStory(story.id, { entryNodeId: e.target.value || undefined })
            }
            disabled={startNodes.length === 0}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "6px",
              fontSize: "12px",
              border: "1px solid var(--app-border)",
              borderRadius: "4px",
              background: "var(--app-input-bg)",
              color: "var(--app-text)",
            }}
          >
            <option value="">— Select Start —</option>
            {startNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {getNodeDisplayName(node)}
              </option>
            ))}
          </select>
        </label>
        {!validation.ok && (
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
            {getPlayValidationMessage(validation)}
          </p>
        )}
      </div>

      <AttributesEditor
        attributes={story.attributes}
        onChange={(next, mergeKey) =>
          updateStory(story.id, { attributes: next ?? null }, { mergeKey })
        }
        mergeKeyPrefix={`attribute:story:${story.id}`}
        flushHistoryCoalesce={flushHistoryCoalesce}
      />
    </div>
  );
}
