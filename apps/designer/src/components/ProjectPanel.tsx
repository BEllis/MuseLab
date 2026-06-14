import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/core/model/types";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { countSceneNodes } from "@/core/model/nodeTypes";
import {
  hasLocaleTag,
  isValidLocaleTag,
  LOCALE_CODE_MAX_LENGTH,
  normalizeLocaleTag,
  sanitizeLocaleCodeInput,
} from "@/core/locale/localeTag";
import { getDefaultLocale } from "@/core/locale/prompts";
import { getDefaultFontId } from "@/core/assets/defaultFont";
import { CloseButton } from "./CloseButton";
import { AddButton } from "./AddButton";
import { StoryTreeView } from "./StoryTreeView";
import { AttributesEditor } from "./AttributesEditor/AttributesEditor";
import { ChevronIcon } from "./tree/treeViewUi";

type LocaleEditField = "code" | "displayName";

function handleFieldEditKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>,
  cancel: () => void
) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
  if (event.key === "Escape") {
    cancel();
  }
}

function LocaleCodeInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder = "Code",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      maxLength={LOCALE_CODE_MAX_LENGTH}
      autoFocus={autoFocus}
      onChange={(e) => onChange(sanitizeLocaleCodeInput(e.target.value))}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      title="Locale code"
      className="story-tree-name-input locale-code-input"
      autoComplete="off"
      spellCheck={false}
    />
  );
}

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

function LocaleRow({
  entry,
  isDefault,
  onSetDefault,
  onUpdate,
  onRemove,
  canRemove,
}: {
  entry: Locale;
  isDefault: boolean;
  onSetDefault: () => void;
  onUpdate: (patch: { locale?: string; displayName?: string }) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [editing, setEditing] = useState<LocaleEditField | null>(null);
  const [editCode, setEditCode] = useState(entry.locale);
  const [editDisplayName, setEditDisplayName] = useState(entry.displayName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setEditCode(entry.locale);
      setEditDisplayName(entry.displayName);
      setError(null);
    }
  }, [entry.displayName, entry.locale, editing]);

  const cancelEdit = useCallback(() => {
    setEditCode(entry.locale);
    setEditDisplayName(entry.displayName);
    setEditing(null);
    setError(null);
  }, [entry.displayName, entry.locale]);

  const startEdit = useCallback(
    (field: LocaleEditField) => {
      setEditing(field);
      setEditCode(entry.locale);
      setEditDisplayName(entry.displayName);
      setError(null);
    },
    [entry.displayName, entry.locale]
  );

  const commitCode = useCallback(() => {
    if (editing !== "code") return;

    const normalizedTag = normalizeLocaleTag(editCode);
    if (!normalizedTag) {
      cancelEdit();
      setError("Enter a locale code");
      return;
    }
    if (!isValidLocaleTag(normalizedTag)) {
      cancelEdit();
      setError("Use lowercase letters and hyphens only");
      return;
    }
    if (normalizedTag === entry.locale) {
      setEditing(null);
      setError(null);
      return;
    }

    try {
      onUpdate({ locale: normalizedTag });
      setEditing(null);
      setError(null);
    } catch (updateError) {
      cancelEdit();
      setError(updateError instanceof Error ? updateError.message : "Could not update locale");
    }
  }, [cancelEdit, editCode, editing, entry.locale, onUpdate]);

  const commitDisplayName = useCallback(() => {
    if (editing !== "displayName") return;

    const trimmedDisplayName = editDisplayName.trim();
    if (!trimmedDisplayName) {
      cancelEdit();
      setError("Enter a display name");
      return;
    }
    if (trimmedDisplayName === entry.displayName) {
      setEditing(null);
      setError(null);
      return;
    }

    try {
      onUpdate({ displayName: trimmedDisplayName });
      setEditing(null);
      setError(null);
    } catch (updateError) {
      cancelEdit();
      setError(updateError instanceof Error ? updateError.message : "Could not update locale");
    }
  }, [cancelEdit, editDisplayName, editing, entry.displayName, onUpdate]);

  return (
    <li className="story-tree-item">
      <div className="story-tree-row" style={{ cursor: "default" }}>
        <input
          type="radio"
          name="default-locale"
          checked={isDefault}
          onChange={onSetDefault}
          title="Default locale"
          style={{ margin: 0, flexShrink: 0 }}
          onClick={(event) => event.stopPropagation()}
        />
        {editing === "code" ? (
          <LocaleCodeInput
            value={editCode}
            autoFocus
            onChange={setEditCode}
            onBlur={commitCode}
            onKeyDown={(event) => handleFieldEditKeyDown(event, cancelEdit)}
          />
        ) : (
          <button
            type="button"
            className="story-tree-name locale-list-code"
            onClick={(event) => {
              event.stopPropagation();
              startEdit("code");
            }}
          >
            {entry.locale}
          </button>
        )}
        {editing === "displayName" ? (
          <input
            type="text"
            value={editDisplayName}
            autoFocus
            className="story-tree-name-input locale-list-display-name-input"
            onChange={(event) => setEditDisplayName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitDisplayName}
            onKeyDown={(event) => handleFieldEditKeyDown(event, cancelEdit)}
          />
        ) : (
          <button
            type="button"
            className="story-tree-name locale-list-display-name"
            onClick={(event) => {
              event.stopPropagation();
              startEdit("displayName");
            }}
          >
            {entry.displayName}
          </button>
        )}
        {isDefault ? <span className="locale-default-label">default</span> : null}
        <span aria-hidden style={{ flex: 1, minWidth: 0 }} />
        <span className="story-tree-row-actions" onClick={(event) => event.stopPropagation()}>
          <CloseButton title="Remove locale" disabled={!canRemove} onClick={onRemove} />
        </span>
      </div>
      {error ? (
        <p
          style={{
            margin: "2px 0 0 22px",
            fontSize: "11px",
            color: "var(--app-node-invalid-border)",
          }}
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

function AddLocaleRow({
  adding,
  onAddingChange,
  onAdd,
  locales,
}: {
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onAdd: (locale: string, displayName: string) => void;
  locales: Locale[];
}) {
  const [newLocaleTag, setNewLocaleTag] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(() => {
    onAddingChange(false);
    setNewLocaleTag("");
    setNewDisplayName("");
    setError(null);
  }, [onAddingChange]);

  const commit = useCallback(() => {
    const normalizedTag = normalizeLocaleTag(newLocaleTag);
    const trimmedDisplayName = newDisplayName.trim();

    if (!normalizedTag) {
      setError("Enter a locale code");
      return;
    }
    if (!isValidLocaleTag(normalizedTag)) {
      setError("Use lowercase letters and hyphens only, with no leading or trailing hyphen");
      return;
    }
    if (!trimmedDisplayName) {
      setError("Enter a display name");
      return;
    }
    if (hasLocaleTag(locales, normalizedTag)) {
      setError("That locale code is already in the project");
      return;
    }

    try {
      onAdd(normalizedTag, trimmedDisplayName);
      cancel();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add locale");
    }
  }, [cancel, locales, newDisplayName, newLocaleTag, onAdd]);

  if (!adding) {
    return null;
  }

  return (
    <li className="story-tree-item">
      <div className="story-tree-row" style={{ cursor: "default" }}>
        <LocaleCodeInput
          value={newLocaleTag}
          autoFocus
          onChange={(value) => {
            setNewLocaleTag(value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              cancel();
            }
          }}
        />
        <input
          type="text"
          value={newDisplayName}
          className="story-tree-name-input"
          placeholder="Display name"
          onChange={(event) => {
            setNewDisplayName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              cancel();
            }
          }}
        />
        <span className="story-tree-row-actions" onClick={(event) => event.stopPropagation()}>
          <AddButton onClick={commit} title="Add locale" />
          <CloseButton title="Cancel" onClick={cancel} />
        </span>
      </div>
      {error ? (
        <p
          style={{
            margin: "2px 0 0 6px",
            fontSize: "11px",
            color: "var(--app-node-invalid-border)",
          }}
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

function LocalesSection({
  locales,
  defaultLocale,
  onSetDefaultLocale,
  onUpdateLocale,
  onRemoveLocale,
  onAddLocale,
}: {
  locales: Locale[];
  defaultLocale: string;
  onSetDefaultLocale: (locale: string) => void;
  onUpdateLocale: (localeId: string, patch: { locale?: string; displayName?: string }) => void;
  onRemoveLocale: (locale: string) => void;
  onAddLocale: (locale: string, displayName: string) => void;
}) {
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [adding, setAdding] = useState(false);

  return (
    <div className="story-tree asset-tree-section">
      <div className="story-tree-toolbar asset-tree-section-header">
        <button
          type="button"
          className="story-tree-section-title"
          onClick={() => setSectionExpanded((expanded) => !expanded)}
        >
          <ChevronIcon expanded={sectionExpanded} />
          <span>Locales</span>
        </button>
        <AddButton
          onClick={() => {
            setSectionExpanded(true);
            setAdding(true);
          }}
          title="Add locale"
        />
      </div>
      {sectionExpanded ? (
        <ul className="story-tree-list story-tree-root">
          {locales.map((entry) => (
            <LocaleRow
              key={entry.id}
              entry={entry}
              isDefault={entry.locale === defaultLocale}
              onSetDefault={() => {
                if (entry.locale === defaultLocale) return;
                onSetDefaultLocale(entry.locale);
              }}
              onUpdate={(patch) => onUpdateLocale(entry.id, patch)}
              onRemove={() => onRemoveLocale(entry.locale)}
              canRemove={locales.length > 1}
            />
          ))}
          <AddLocaleRow
            adding={adding}
            onAddingChange={setAdding}
            onAdd={onAddLocale}
            locales={locales}
          />
        </ul>
      ) : null}
    </div>
  );
}

export function ProjectPanel() {
  const project = useProjectStore((s) => s.project);
  const { story } = useActiveStory();
  const updateProject = useProjectStore((s) => s.updateProject);
  const addLocale = useProjectStore((s) => s.addLocale);
  const updateLocale = useProjectStore((s) => s.updateLocale);
  const removeLocale = useProjectStore((s) => s.removeLocale);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);

  const defaultLocale = getDefaultLocale(project);
  const defaultFontId = getDefaultFontId(project);
  const fontAssets = project.assets.filter((asset) => asset.type === "font");

  const [name, setName] = useState(project.name);

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

  const handleAddLocale = useCallback(
    (locale: string, displayName: string) => {
      addLocale(locale, displayName);
    },
    [addLocale]
  );

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
        <StatRow label="Scenes" value={countSceneNodes(story)} />
        <StatRow label="Links" value={story.edges.length} />
        <StatRow label="Assets" value={project.assets.length} />
      </div>

      <LocalesSection
        locales={project.locales}
        defaultLocale={defaultLocale}
        onSetDefaultLocale={(locale) => updateProject({ defaultLocale: locale })}
        onUpdateLocale={(localeId, patch) => updateLocale(localeId, patch)}
        onRemoveLocale={removeLocale}
        onAddLocale={handleAddLocale}
      />

      <label style={{ display: "block", marginBottom: "16px", fontSize: "12px" }}>
        <strong>Default font</strong>
        <select
          value={defaultFontId}
          onChange={(e) => updateProject({ defaultFontId: e.target.value })}
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
          {fontAssets.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name}
            </option>
          ))}
        </select>
      </label>

      <StoryTreeView />

      <AttributesEditor
        title="Project attributes"
        attributes={project.attributes}
        onChange={(next, mergeKey) =>
          updateProject({ attributes: next ?? null }, { mergeKey })
        }
        mergeKeyPrefix="attribute:project"
        flushHistoryCoalesce={flushHistoryCoalesce}
      />
    </div>
  );
}
