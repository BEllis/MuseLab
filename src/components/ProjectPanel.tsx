import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import { getPlayValidationMessage } from "@/core/model/playValidationMessage";
import { isValidLocaleTag, normalizeLocaleTag } from "@/core/locale/localeTag";
import {
  loadProject,
  newProjectWithPrompt,
  saveProject,
} from "@/core/project/projectFileActions";

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
  const updateProject = useProjectStore((s) => s.updateProject);
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

  const validation = validatePlayEntry(project);
  const entryLabel =
    validation.ok
      ? project.nodes.find((node) => node.id === validation.entryNodeId)?.label ??
        validation.entryNodeId
      : null;

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
        <StatRow label="Scenes" value={project.nodes.length} />
        <StatRow label="Links" value={project.edges.length} />
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
              <button
                type="button"
                className="app-side-panel-button"
                disabled={project.locales.length <= 1}
                onClick={() => removeLocale(locale)}
                style={{ padding: "2px 8px", fontSize: "11px" }}
              >
                Remove
              </button>
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
          <button type="button" className="app-side-panel-button" onClick={commitNewLocale}>
            Add
          </button>
        </div>
        {localeError && (
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
            {localeError}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <strong style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Play start</strong>
        {validation.ok ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--app-text-muted)" }}>{entryLabel}</p>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--app-node-invalid-border)" }}>
            {getPlayValidationMessage(validation)}
          </p>
        )}
      </div>

      <div>
        <strong style={{ display: "block", fontSize: "12px", marginBottom: "8px" }}>File</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button type="button" className="app-side-panel-button" onClick={() => void newProjectWithPrompt()}>
            New project
          </button>
          <button type="button" className="app-side-panel-button" onClick={() => void saveProject()}>
            Save project
          </button>
          <button type="button" className="app-side-panel-button" onClick={() => void loadProject()}>
            Load project
          </button>
        </div>
      </div>
    </div>
  );
}
