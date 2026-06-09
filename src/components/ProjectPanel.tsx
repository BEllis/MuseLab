import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { getPlayValidationMessage } from "@/core/model/playValidationMessage";
import { getNodeDisplayName } from "@/core/model/nodeNames";
import { getStartNodes } from "@/core/model/nodeTypes";
import { isValidLocaleTag, normalizeLocaleTag } from "@/core/locale/localeTag";
import { CloseButton } from "./CloseButton";
import { AddButton } from "./AddButton";

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

export function ProjectPanel() {
  const project = useProjectStore((s) => s.project);
  const { story, storyId } = useActiveStory();
  const updateProject = useProjectStore((s) => s.updateProject);
  const updateStory = useProjectStore((s) => s.updateStory);
  const addLocale = useProjectStore((s) => s.addLocale);
  const removeLocale = useProjectStore((s) => s.removeLocale);

  const [name, setName] = useState(project.name);
  const [newLocale, setNewLocale] = useState("");
  const [localeError, setLocaleError] = useState<string | null>(null);
  useEffect(() => {
    setName(project.name);
  }, [project.name]);

  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      return;
    }
    updateProject({ name: trimmed });
  }, [name, project.name, updateProject]);

  const validation = validatePlayEntry(story);
  const startNodes = getStartNodes(story);

  const commitNewLocale = useCallback(() => {
    const normalized = normalizeLocaleTag(newLocale);
    if (!normalized) {
      setLocaleError("Enter a locale tag");
      return;
    }
    if (!isValidLocaleTag(normalized)) {
      setLocaleError("Use lowercase letters and hyphens only, with no leading or trailing hyphen");
      return;
    }
    if (project.locales.includes(normalized)) {
      setLocaleError("That locale is already in the project");
      return;
    }
    try {
      addLocale(normalized);
      setNewLocale("");
      setLocaleError(null);
    } catch (error) {
      setLocaleError(error instanceof Error ? error.message : "Could not add locale");
    }
  }, [addLocale, newLocale, project.locales]);

  return (
    <div>
      <label style={{ display: "block", marginBottom: "12px", fontSize: "12px" }}>
        Title
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setName(project.name);
              e.currentTarget.blur();
            }
          }}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            fontSize: "13px",
            border: "1px solid var(--app-border)",
            borderRadius: "4px",
            background: "var(--app-input-bg)",
            color: "var(--app-text)",
          }}
        />
      </label>

      <div style={{ marginBottom: "16px" }}>
        <strong style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Summary</strong>
        <StatRow label="Stories" value={project.stories.length} />
        <StatRow label="Scenes" value={story.nodes.length} />
        <StatRow label="Links" value={story.edges.length} />
        <StatRow label="Assets" value={project.assets.length} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <strong style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Locales</strong>
        <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none" }}>
          {project.locales.map((locale, index) => (
            <li
              key={locale}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
                marginBottom: "4px",
              }}
            >
              <span>
                {locale}
                {index === 0 ? " (default)" : ""}
              </span>
              <CloseButton
                title="Remove locale"
                disabled={project.locales.length <= 1}
                onClick={() => removeLocale(locale)}
              />
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={newLocale}
            onChange={(e) => {
              setNewLocale(e.target.value);
              setLocaleError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNewLocale();
              }
            }}
            placeholder="e.g. de or pt-br"
            style={{
              flex: 1,
              padding: "6px",
              fontSize: "12px",
              border: "1px solid var(--app-border)",
              borderRadius: "4px",
              background: "var(--app-input-bg)",
              color: "var(--app-text)",
            }}
          />
          <AddButton onClick={commitNewLocale} title="Add locale" />
        </div>
        {localeError && (
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
            {localeError}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>
          <strong>Start at</strong>
          <select
            value={story.entryNodeId ?? ""}
            onChange={(e) =>
              updateStory(storyId, { entryNodeId: e.target.value || undefined })
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
    </div>
  );
}
