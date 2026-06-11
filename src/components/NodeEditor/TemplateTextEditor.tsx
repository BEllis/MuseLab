import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_FONT_ID } from "@/core/assets/defaultFont";
import type { Locale, Project } from "@/core/model/types";
import {
  SINGLE_LINE_HEIGHT,
  TemplateCodeEditor,
  type TemplateCodeEditorHandle,
} from "./templateEditor/TemplateCodeEditor";
import { applyColorAtCursor } from "./templateEditor/colorCommands";
import { insertAroundSelection, insertAtCursor } from "./templateEditor/editorCommands";
import {
  collapseAllTemplateFolds,
  expandAllTemplateFolds,
} from "./templateEditor/templateFoldCommands";
import {
  TemplateToolbarDropdown,
  TemplateToolbarMenuItem,
} from "./templateEditor/TemplateToolbarDropdown";
import type { TemplateErrorRange } from "./templateEditor/templateErrorHighlight";

const DEFAULT_MIN_HEIGHT = 120;
const DEFAULT_MAX_HEIGHT = 280;
const REVEAL_OVER_TIME_MS = 2000;
const DEFAULT_WAIT_MS = 500;

const toolbarButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid var(--app-button-border)",
  borderRadius: "4px",
  background: "var(--app-button-bg)",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: "13px",
};

const toolbarSeparatorStyle: React.CSSProperties = {
  width: "1px",
  height: "20px",
  background: "var(--app-border)",
  flexShrink: 0,
};

function ToolbarSeparator() {
  return <span style={toolbarSeparatorStyle} aria-hidden />;
}

const toolbarIconButtonStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
};

const ARROW_MARKER = {
  viewBox: "0 0 10 10",
  markerWidth: 4,
  markerHeight: 4,
  refX: 8,
  refY: 5,
  head: "M0 0 L10 5 L0 10 Z",
} as const;

function CollapseAllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <defs>
        <marker
          id="muselab-template-collapse-arrow"
          viewBox={ARROW_MARKER.viewBox}
          refX={ARROW_MARKER.refX}
          refY={ARROW_MARKER.refY}
          markerWidth={ARROW_MARKER.markerWidth}
          markerHeight={ARROW_MARKER.markerHeight}
          orient="auto"
        >
          <path d={ARROW_MARKER.head} fill="currentColor" />
        </marker>
      </defs>
      <line
        x1="0.75"
        y1="0.75"
        x2="5.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerEnd="url(#muselab-template-collapse-arrow)"
      />
      <line
        x1="13.25"
        y1="0.75"
        x2="8.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerEnd="url(#muselab-template-collapse-arrow)"
      />
      <line
        x1="0.75"
        y1="13.25"
        x2="5.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerEnd="url(#muselab-template-collapse-arrow)"
      />
      <line
        x1="13.25"
        y1="13.25"
        x2="8.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerEnd="url(#muselab-template-collapse-arrow)"
      />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <defs>
        <marker
          id="muselab-template-expand-arrow"
          viewBox={ARROW_MARKER.viewBox}
          refX={ARROW_MARKER.refX}
          refY={ARROW_MARKER.refY}
          markerWidth={ARROW_MARKER.markerWidth}
          markerHeight={ARROW_MARKER.markerHeight}
          orient="auto-start-reverse"
        >
          <path d={ARROW_MARKER.head} fill="currentColor" />
        </marker>
      </defs>
      <line
        x1="0.75"
        y1="0.75"
        x2="5.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerStart="url(#muselab-template-expand-arrow)"
      />
      <line
        x1="13.25"
        y1="0.75"
        x2="8.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerStart="url(#muselab-template-expand-arrow)"
      />
      <line
        x1="0.75"
        y1="13.25"
        x2="5.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerStart="url(#muselab-template-expand-arrow)"
      />
      <line
        x1="13.25"
        y1="13.25"
        x2="8.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.25"
        markerStart="url(#muselab-template-expand-arrow)"
      />
    </svg>
  );
}

export function TemplateTextEditor({
  value,
  onChange,
  onBlurCommit,
  onFocus,
  onDraftChange,
  syncKey,
  placeholder = "",
  style,
  showToolbar = true,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  soundAssets = [],
  project,
  speaker,
  onSpeakerChange,
  locale,
  locales,
  onLocaleChange,
  templateError,
}: {
  value: string;
  onChange: (markup: string) => void;
  onBlurCommit?: () => void;
  onFocus?: () => void;
  onDraftChange?: (draft: string) => void;
  syncKey: string | undefined;
  placeholder?: string;
  style?: React.CSSProperties;
  showToolbar?: boolean;
  minHeight?: number;
  maxHeight?: number;
  soundAssets?: Array<{ id: string; name: string }>;
  project: Project;
  speaker?: string;
  onSpeakerChange?: (speaker: string) => void;
  locale?: string;
  locales?: Locale[];
  onLocaleChange?: (locale: string) => void;
  templateError?: { message: string; from?: number; to?: number } | null;
}) {
  const templateErrorRange: TemplateErrorRange | null =
    templateError?.from !== undefined &&
    templateError.to !== undefined &&
    templateError.from < templateError.to
      ? {
          from: templateError.from,
          to: templateError.to,
          message: templateError.message,
        }
      : null;
  const editorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const speakerEditorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const activeEditorRef = useRef<"template" | "speaker">("template");
  const [draft, setDraft] = useState(value ?? "");
  const [colorPickerValue, setColorPickerValue] = useState("#000000");
  const [selectedSoundId, setSelectedSoundId] = useState("");
  const fontAssets = useMemo(() => {
    const fonts = project.assets
      .filter((asset) => asset.type === "font")
      .map((asset) => ({ id: asset.id, name: asset.name }));
    fonts.sort((a, b) => {
      if (a.id === DEFAULT_FONT_ID) return -1;
      if (b.id === DEFAULT_FONT_ID) return 1;
      return a.name.localeCompare(b.name);
    });
    return fonts;
  }, [project.assets]);
  const committedValueRef = useRef(value ?? "");
  const lastExternalSyncKeyRef = useRef(syncKey);

  useEffect(() => {
    const syncKeyChanged = syncKey !== lastExternalSyncKeyRef.current;
    lastExternalSyncKeyRef.current = syncKey;
    if (!syncKeyChanged) return;

    const next = value ?? "";
    committedValueRef.current = next;
    setDraft(next);
    onDraftChange?.(next);
  }, [syncKey, value, onDraftChange]);

  const commit = useCallback(
    (next: string) => {
      if (next === committedValueRef.current) return;
      committedValueRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const getActiveView = useCallback(() => {
    const ref = activeEditorRef.current === "speaker" ? speakerEditorRef : editorRef;
    return ref.current?.getView() ?? null;
  }, []);

  const applyEdit = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
      getActiveView()?.focus();
    },
    [commit, getActiveView, onDraftChange]
  );

  const applySpeakerEdit = useCallback(
    (next: string) => {
      onSpeakerChange?.(next);
      getActiveView()?.focus();
    },
    [getActiveView, onSpeakerChange]
  );

  const applyActiveEdit = useCallback(
    (next: string) => {
      if (activeEditorRef.current === "speaker") {
        applySpeakerEdit(next);
        return;
      }
      applyEdit(next);
    },
    [applyEdit, applySpeakerEdit]
  );

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
    },
    [commit, onDraftChange]
  );

  const handleBlur = useCallback(() => {
    commit(draft);
    onBlurCommit?.();
  }, [commit, draft, onBlurCommit]);

  const applyWrap = useCallback(
    (open: string, close: string) => {
      const view = getActiveView();
      if (!view) return;
      const next = insertAroundSelection(view, open, close);
      applyActiveEdit(next);
    },
    [applyActiveEdit, getActiveView]
  );

  const applyColor = useCallback(
    (color: string) => {
      const view = getActiveView();
      if (!view) return;
      const next = applyColorAtCursor(view, color);
      applyActiveEdit(next);
    },
    [applyActiveEdit, getActiveView]
  );

  const handleApplyColor = useCallback(() => {
    applyColor(colorPickerValue);
  }, [applyColor, colorPickerValue]);

  const insertSnippet = useCallback(
    (text: string) => {
      const view = getActiveView();
      if (!view) return;
      const next = insertAtCursor(view, text);
      applyActiveEdit(next);
    },
    [applyActiveEdit, getActiveView]
  );

  const handleTemplateFocus = useCallback(() => {
    activeEditorRef.current = "template";
    onFocus?.();
  }, [onFocus]);

  const handleSpeakerFocus = useCallback(() => {
    activeEditorRef.current = "speaker";
  }, []);

  const handleCollapseAll = useCallback(() => {
    const view = editorRef.current?.getView();
    if (!view) return;
    collapseAllTemplateFolds(view);
    view.focus();
  }, []);

  const handleExpandAll = useCallback(() => {
    const view = editorRef.current?.getView();
    if (!view) return;
    expandAllTemplateFolds(view);
    view.focus();
  }, []);

  const soundInsertDisabled = !selectedSoundId || soundAssets.length === 0;
  const showPromptMeta = locales != null && onLocaleChange != null;

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: "6px", overflow: "hidden", ...style }}>
      {showToolbar && (
        <div
          onMouseDown={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLSelectElement ||
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement
            ) {
              return;
            }
            event.preventDefault();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px",
            background: "var(--app-surface-hover)",
            borderBottom: "1px solid var(--app-border)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => applyWrap("@Format.BoldStart()", "@Format.BoldEnd()")}
            title="Bold"
            style={{ ...toolbarButtonStyle, fontWeight: "bold" }}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyWrap("@Format.ItalicStart()", "@Format.ItalicEnd()")}
            title="Italic"
            style={{ ...toolbarButtonStyle, fontStyle: "italic" }}
          >
            I
          </button>
          <input
            type="color"
            value={colorPickerValue}
            title="Pick text color"
            onChange={(e) => setColorPickerValue(e.target.value)}
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              border: "1px solid var(--app-border)",
              borderRadius: "4px",
              cursor: "pointer",
              background: "var(--app-input-bg)",
            }}
          />
          <button
            type="button"
            onClick={handleApplyColor}
            title="Apply color to selection, or insert @Format.ColorStart at cursor"
            style={toolbarButtonStyle}
          >
            Apply color
          </button>

          <TemplateToolbarDropdown label="Font">
            {(close) => (
              <>
                {fontAssets.length === 0 ? (
                  <TemplateToolbarMenuItem
                    label="No fonts available"
                    disabled
                    onClick={() => {}}
                  />
                ) : (
                  fontAssets.map((asset) => (
                    <TemplateToolbarMenuItem
                      key={asset.id}
                      label={asset.name}
                      title={`Wrap selection with ${asset.name}`}
                      onClick={() => {
                        applyWrap(
                          `@Format.FontStyleBegin("${asset.id}")`,
                          "@Format.FontStyleEnd()"
                        );
                        close();
                      }}
                    />
                  ))
                )}
              </>
            )}
          </TemplateToolbarDropdown>

          <ToolbarSeparator />

          <TemplateToolbarDropdown label="Shake">
            {(close) => (
              <>
                <TemplateToolbarMenuItem
                  label="Chars"
                  title="Per-character shake"
                  onClick={() => {
                    applyWrap("@Format.ShakeCharsStart()", "@Format.ShakeCharsEnd()");
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Phrase"
                  title="Phrase shake"
                  onClick={() => {
                    applyWrap("@Format.ShakePhraseStart()", "@Format.ShakePhraseEnd()");
                    close();
                  }}
                />
              </>
            )}
          </TemplateToolbarDropdown>

          <TemplateToolbarDropdown label="Reveal">
            {(close) => (
              <>
                <TemplateToolbarMenuItem
                  label="Chars"
                  title="Reveal by character"
                  onClick={() => {
                    applyWrap(
                      "@{ prompter.RevealCharsBegin(-1); }",
                      "@{ prompter.RevealEnd(); }"
                    );
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Words"
                  title="Reveal by word"
                  onClick={() => {
                    applyWrap(
                      "@{ prompter.RevealWordsBegin(-1); }",
                      "@{ prompter.RevealEnd(); }"
                    );
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Chars/time"
                  title={`Reveal by character over ${REVEAL_OVER_TIME_MS}ms`}
                  onClick={() => {
                    applyWrap(
                      `@{ prompter.RevealCharsOverTimeBegin(${REVEAL_OVER_TIME_MS}); }`,
                      "@{ prompter.RevealEnd(); }"
                    );
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Words/time"
                  title={`Reveal by word over ${REVEAL_OVER_TIME_MS}ms`}
                  onClick={() => {
                    applyWrap(
                      `@{ prompter.RevealWordsOverTimeBegin(${REVEAL_OVER_TIME_MS}); }`,
                      "@{ prompter.RevealEnd(); }"
                    );
                    close();
                  }}
                />
              </>
            )}
          </TemplateToolbarDropdown>

          <TemplateToolbarDropdown label="Wait">
            {(close) => (
              <>
                <TemplateToolbarMenuItem
                  label="WaitInMs"
                  title={`WaitInMs(${DEFAULT_WAIT_MS})`}
                  onClick={() => {
                    insertSnippet(`@{ prompter.WaitInMs(${DEFAULT_WAIT_MS}); }`);
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="WaitForContinue"
                  title="Wait for player to continue"
                  onClick={() => {
                    insertSnippet("@{ prompter.WaitForContinue(); }");
                    close();
                  }}
                />
              </>
            )}
          </TemplateToolbarDropdown>

          <TemplateToolbarDropdown label="Dialogue">
            {(close) => (
              <>
                <TemplateToolbarMenuItem
                  label="UpdateSpeaker"
                  title='Insert UpdateSpeaker (edit "Maya" after insert)'
                  onClick={() => {
                    insertSnippet('@{ prompter.UpdateSpeaker("Maya"); }');
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Reset"
                  title="Clear prompt text and reset the speaker"
                  onClick={() => {
                    insertSnippet("@{ prompter.Reset(); }");
                    close();
                  }}
                />
                <TemplateToolbarMenuItem
                  label="Clear"
                  title="Clear prompt text but keep the current speaker"
                  onClick={() => {
                    insertSnippet("@{ prompter.Clear(); }");
                    close();
                  }}
                />
              </>
            )}
          </TemplateToolbarDropdown>

          <TemplateToolbarDropdown label="Sound">
            {(close) => (
              <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <select
                  value={selectedSoundId}
                  onChange={(e) => setSelectedSoundId(e.target.value)}
                  disabled={soundAssets.length === 0}
                  title="Select sound asset"
                  style={{
                    fontSize: "12px",
                    padding: "4px 6px",
                    border: "1px solid var(--app-border)",
                    borderRadius: "4px",
                    background: "var(--app-surface)",
                    color: "var(--app-text)",
                    width: "100%",
                  }}
                >
                  <option value="">— Select —</option>
                  {soundAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="app-context-menu-item"
                  onClick={() => {
                    insertSnippet(`@{ rt.PlaySoundClip("${selectedSoundId}", 0, -1, -1); }`);
                    close();
                  }}
                  title="Play sound when the prompt reaches this point"
                  disabled={soundInsertDisabled}
                  style={{
                    borderRadius: "4px",
                    opacity: soundInsertDisabled ? 0.5 : 1,
                    cursor: soundInsertDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  Play
                </button>
              </div>
            )}
          </TemplateToolbarDropdown>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleCollapseAll}
              title="Collapse all inline expressions and code blocks"
              aria-label="Collapse all inline expressions and code blocks"
              className="app-icon-button"
              style={toolbarIconButtonStyle}
            >
              <CollapseAllIcon />
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              title="Expand all collapsed expressions and code blocks"
              aria-label="Expand all collapsed expressions and code blocks"
              className="app-icon-button"
              style={toolbarIconButtonStyle}
            >
              <ExpandAllIcon />
            </button>
          </div>
        </div>
      )}
      {showPromptMeta && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "6px 8px",
            background: "var(--app-surface)",
            borderBottom: "1px solid var(--app-border)",
            flexShrink: 0,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              minWidth: 0,
              fontSize: "13px",
            }}
          >
            <span style={{ color: "var(--app-text-muted)", flexShrink: 0 }}>Speaker</span>
            {onSpeakerChange && (
              <TemplateCodeEditor
                mode="singleLine"
                value={speaker ?? ""}
                onChange={onSpeakerChange}
                onFocus={handleSpeakerFocus}
                syncKey={syncKey}
                project={project}
                placeholder="Optional — supports Cito"
                minHeight={SINGLE_LINE_HEIGHT}
                maxHeight={SINGLE_LINE_HEIGHT}
                editorRef={speakerEditorRef}
              />
            )}
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "var(--app-text-muted)" }}>Locale</span>
            <select
              value={locale ?? locales[0]?.locale ?? ""}
              onChange={(e) => onLocaleChange(e.target.value)}
              style={{
                padding: "6px 8px",
                fontSize: "13px",
                border: "1px solid var(--app-border)",
                borderRadius: "4px",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
              }}
            >
              {locales.map((entry) => (
                <option key={entry.id} value={entry.locale}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <TemplateCodeEditor
        value={draft}
        placeholder={placeholder}
        project={project}
        minHeight={minHeight}
        maxHeight={maxHeight}
        onChange={handleDraftChange}
        onFocus={handleTemplateFocus}
        onBlur={handleBlur}
        syncKey={syncKey}
        editorRef={editorRef}
        errorRange={templateErrorRange}
      />
    </div>
  );
}
