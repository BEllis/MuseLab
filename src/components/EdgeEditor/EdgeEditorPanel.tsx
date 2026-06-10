import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { getEdgeOptionTextForLocale } from "@/core/locale/prompts";
import { CloseButton } from "../CloseButton";
import { LocaleVisibilityToggle } from "../LocaleVisibilityToggle";
import { InspectorPanelDetails, InspectorPanelId, inspectorSubtextStyle } from "../InspectorPanelMeta";
import { AttributesEditor } from "../AttributesEditor/AttributesEditor";

export function EdgeEditorPanel() {
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const { story, storyId } = useActiveStory();
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateEdge = useProjectStore((s) => s.updateEdge);
  const updateEdgePrompt = useProjectStore((s) => s.updateEdgePrompt);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const [visibleLocales, setVisibleLocales] = useState<string[]>(project.locales);

  useEffect(() => {
    setVisibleLocales(project.locales);
  }, [project.locales]);

  const edge =
    selectedEdgeIds.length === 1
      ? story.edges.find((e) => e.id === selectedEdgeIds[0])
      : null;

  if (!edge) return null;

  const sourceLabel = story.nodes.find((n) => n.id === edge.sourceNodeId)?.label ?? edge.sourceNodeId;
  const targetLabel = story.nodes.find((n) => n.id === edge.targetNodeId)?.label ?? edge.targetNodeId;

  return (
    <div className="app-inspector-panel-body">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <strong>Link</strong>
        <CloseButton onClick={() => clearSelection()} />
      </div>
      <InspectorPanelId id={edge.id} />

      <div style={{ marginBottom: "8px" }}>
        <LocaleVisibilityToggle
          locales={project.locales}
          visibleLocales={visibleLocales}
          onChange={setVisibleLocales}
        />
        {visibleLocales.map((locale) => (
          <label key={locale} style={{ display: "block", marginBottom: "8px" }}>
            Option text ({locale})
            <input
              type="text"
              value={getEdgeOptionTextForLocale(promptsByLocale, locale, storyId, edge.id) ?? ""}
              onChange={(e) =>
                updateEdgePrompt(
                  locale,
                  edge.id,
                  e.target.value || undefined,
                  { mergeKey: `edge-field:${edge.id}:optionText:${locale}` }
                )
              }
              onBlur={() => flushHistoryCoalesce()}
              placeholder="e.g. Go left"
              style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
            />
          </label>
        ))}
      </div>

      <InspectorPanelDetails>
        <p style={inspectorSubtextStyle}>
          {sourceLabel} → {targetLabel}
        </p>
      </InspectorPanelDetails>

      <label style={{ display: "block" }}>
        Condition (Cito expression; leave empty to always show)
        <textarea
          value={edge.condition ?? ""}
          onChange={(e) =>
            updateEdge(
              edge.id,
              { condition: e.target.value || undefined },
              { mergeKey: `edge-field:${edge.id}:condition` }
            )
          }
          onBlur={() => flushHistoryCoalesce()}
          placeholder="e.g. state.visitedForest"
          rows={2}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        />
      </label>

      <AttributesEditor
        attributes={edge.attributes}
        onChange={(next, mergeKey) =>
          updateEdge(edge.id, { attributes: next ?? null }, { mergeKey })
        }
        mergeKeyPrefix={`attribute:edge:${edge.id}`}
        flushHistoryCoalesce={flushHistoryCoalesce}
      />
    </div>
  );
}
