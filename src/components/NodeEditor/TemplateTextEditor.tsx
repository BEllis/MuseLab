import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/core/model/types";
import {
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
  border: "1px solid var(--app-border)",
  borderRadius: "4px",
  background: "var(--app-surface)",
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
}) {
  const editorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const [draft, setDraft] = useState(value ?? "");
  const [colorPickerValue, setColorPickerValue] = useState("#000000");
  const colorAtPickerOpenRef = useRef(colorPickerValue);
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

  const applyEdit = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
      editorRef.current?.getView()?.focus();
    },
    [commit, onDraftChange]
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
      const view = editorRef.current?.getView();
      if (!view) return;
      const next = insertAroundSelection(view, open, close);
      applyEdit(next);
    },
    [applyEdit]
  );

  const applyColor = useCallback(
    (color: string) => {
      const view = editorRef.current?.getView();
      if (!view) return;
      const next = applyColorAtCursor(view, color);
      applyEdit(next);
    },
    [applyEdit]
  );

  const handleColorPickerFocus = useCallback(() => {
    colorAtPickerOpenRef.current = colorPickerValue;
  }, [colorPickerValue]);

  const handleColorPickerBlur = useCallback(() => {
    if (colorPickerValue === colorAtPickerOpenRef.current) return;
    applyColor(colorPickerValue);
  }, [applyColor, colorPickerValue]);

  const insertSnippet = useCallback(
    (text: string) => {
      const view = editorRef.current?.getView();
      if (!view) return;
      const next = insertAtCursor(view, text);
      applyEdit(next);
    },
    [applyEdit]
  );

  const soundInsertDisabled = !selectedSoundId || soundAssets.length === 0;

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: "6px", overflow: "hidden", ...style }}>
      {showToolbar && (
        <div
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
          <span style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>Color:</span>
          <input
            type="color"
            value={colorPickerValue}
            title="Text color"
            onChange={(e) => setColorPickerValue(e.target.value)}
            onFocus={handleColorPickerFocus}
            onBlur={handleColorPickerBlur}
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
      <TemplateCodeEditor
        value={draft}
        placeholder={placeholder}
        project={project}
        minHeight={minHeight}
        maxHeight={maxHeight}
        onChange={handleDraftChange}
        onFocus={onFocus}
        onBlur={handleBlur}
        syncKey={syncKey}
        editorRef={editorRef}
      />
    </div>
  );
}
