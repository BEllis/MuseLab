import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, Project } from "@/core/model/types";
import {
  SINGLE_LINE_HEIGHT,
  TemplateCodeEditor,
  type TemplateCodeEditorHandle,
} from "./templateEditor/TemplateCodeEditor";
import { applyColorAtCursor } from "./templateEditor/colorCommands";
import { insertAroundSelection, insertAtCursor } from "./templateEditor/editorCommands";

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
}) {
  const editorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const speakerEditorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const activeEditorRef = useRef<"template" | "speaker">("template");
  const [draft, setDraft] = useState(value ?? "");
  const [colorPickerValue, setColorPickerValue] = useState("#000000");
  const [selectedSoundId, setSelectedSoundId] = useState("");
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

  const soundInsertDisabled = !selectedSoundId || soundAssets.length === 0;
  const showPromptMeta = locales != null && onLocaleChange != null;

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: "6px", overflow: "hidden", ...style }}>
      {showToolbar && (
        <div
          onMouseDown={(event) => event.preventDefault()}
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

          <ToolbarSeparator />

          <span style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>Shake:</span>
          <button
            type="button"
            onClick={() =>
              applyWrap("@Format.ShakeCharsStart()", "@Format.ShakeCharsEnd()")
            }
            title="Per-character shake"
            style={toolbarButtonStyle}
          >
            Chars
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap("@Format.ShakePhraseStart()", "@Format.ShakePhraseEnd()")
            }
            title="Phrase shake"
            style={toolbarButtonStyle}
          >
            Phrase
          </button>

          <ToolbarSeparator />

          <span style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>Reveal:</span>
          <button
            type="button"
            onClick={() =>
              applyWrap("@{ prompter.RevealCharsBegin(-1); }", "@{ prompter.RevealEnd(); }")
            }
            title="Reveal by character"
            style={toolbarButtonStyle}
          >
            Chars
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap("@{ prompter.RevealWordsBegin(-1); }", "@{ prompter.RevealEnd(); }")
            }
            title="Reveal by word"
            style={toolbarButtonStyle}
          >
            Words
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap(
                `@{ prompter.RevealCharsOverTimeBegin(${REVEAL_OVER_TIME_MS}); }`,
                "@{ prompter.RevealEnd(); }"
              )
            }
            title={`Reveal by character over ${REVEAL_OVER_TIME_MS}ms`}
            style={toolbarButtonStyle}
          >
            Chars/time
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap(
                `@{ prompter.RevealWordsOverTimeBegin(${REVEAL_OVER_TIME_MS}); }`,
                "@{ prompter.RevealEnd(); }"
              )
            }
            title={`Reveal by word over ${REVEAL_OVER_TIME_MS}ms`}
            style={toolbarButtonStyle}
          >
            Words/time
          </button>

          <ToolbarSeparator />

          <button
            type="button"
            onClick={() => insertSnippet(`@{ prompter.WaitInMs(${DEFAULT_WAIT_MS}); }`)}
            title={`WaitInMs(${DEFAULT_WAIT_MS})`}
            style={toolbarButtonStyle}
          >
            WaitInMs
          </button>

          <ToolbarSeparator />

          <span style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>Sound:</span>
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
              maxWidth: "140px",
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
            onClick={() =>
              insertSnippet(`@{ rt.PlaySoundClip("${selectedSoundId}", 0, -1, -1); }`)
            }
            title="Play sound when the prompt reaches this point"
            disabled={soundInsertDisabled}
            style={{
              ...toolbarButtonStyle,
              opacity: soundInsertDisabled ? 0.5 : 1,
              cursor: soundInsertDisabled ? "not-allowed" : "pointer",
            }}
          >
            Play
          </button>
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
      />
    </div>
  );
}
