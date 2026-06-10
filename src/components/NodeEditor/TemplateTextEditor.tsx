import { useCallback, useEffect, useRef, useState } from "react";

const COMMIT_IDLE_MS = 700;
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

function insertAroundSelection(
  textarea: HTMLTextAreaElement,
  open: string,
  close: string
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  return value.slice(0, start) + open + selected + close + value.slice(end);
}

function insertAtSelection(textarea: HTMLTextAreaElement, text: string): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  return value.slice(0, start) + text + value.slice(end);
}

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
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? "");
  const [selectedSoundId, setSelectedSoundId] = useState("");
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedValueRef = useRef(value ?? "");

  useEffect(() => {
    const next = value ?? "";
    committedValueRef.current = next;
    setDraft(next);
    onDraftChange?.(next);
    const el = textareaRef.current;
    if (el && syncKey !== undefined && el.value !== next) {
      el.value = next;
    }
  }, [syncKey, value, onDraftChange]);

  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    []
  );

  const commit = useCallback(
    (next: string) => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      if (next === committedValueRef.current) return;
      committedValueRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const scheduleCommit = useCallback(
    (next: string) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;
        commit(next);
      }, COMMIT_IDLE_MS);
    },
    [commit]
  );

  const applyEdit = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const cursor = el.selectionStart;
        el.setSelectionRange(cursor, cursor);
      }
    },
    [commit, onDraftChange]
  );

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
      scheduleCommit(next);
    },
    [onDraftChange, scheduleCommit]
  );

  const handleBlur = useCallback(() => {
    commit(draft);
    onBlurCommit?.();
  }, [commit, draft, onBlurCommit]);

  const applyWrap = useCallback(
    (open: string, close: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const next = insertAroundSelection(el, open, close);
      applyEdit(next);
    },
    [applyEdit]
  );

  const applyColor = useCallback(
    (color: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const open = `{{ Format.ColorStart("${color}") }}`;
      const hasSelection = el.selectionStart !== el.selectionEnd;
      const next = hasSelection
        ? insertAroundSelection(el, open, "{{ Format.ColorEnd() }}")
        : insertAtSelection(el, open);
      applyEdit(next);
    },
    [applyEdit]
  );

  const insertSnippet = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const next = insertAtSelection(el, text);
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
            onClick={() => applyWrap("{{ Format.BoldStart() }}", "{{ Format.BoldEnd() }}")}
            title="Bold"
            style={{ ...toolbarButtonStyle, fontWeight: "bold" }}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyWrap("{{ Format.ItalicStart() }}", "{{ Format.ItalicEnd() }}")}
            title="Italic"
            style={{ ...toolbarButtonStyle, fontStyle: "italic" }}
          >
            I
          </button>
          <span style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>Color:</span>
          <input
            type="color"
            defaultValue="#000000"
            title="Text color"
            onChange={(e) => applyColor(e.target.value)}
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
              applyWrap("{{ Format.ShakeCharsStart() }}", "{{ Format.ShakeCharsEnd() }}")
            }
            title="Per-character shake"
            style={toolbarButtonStyle}
          >
            Chars
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap("{{ Format.ShakePhraseStart() }}", "{{ Format.ShakePhraseEnd() }}")
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
              applyWrap("{{ prompter.RevealCharsBegin(-1) }}", "{{ prompter.RevealEnd() }}")
            }
            title="Reveal by character"
            style={toolbarButtonStyle}
          >
            Chars
          </button>
          <button
            type="button"
            onClick={() =>
              applyWrap("{{ prompter.RevealWordsBegin(-1) }}", "{{ prompter.RevealEnd() }}")
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
                `{{ prompter.RevealCharsOverTimeBegin(${REVEAL_OVER_TIME_MS}) }}`,
                "{{ prompter.RevealEnd() }}"
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
                `{{ prompter.RevealWordsOverTimeBegin(${REVEAL_OVER_TIME_MS}) }}`,
                "{{ prompter.RevealEnd() }}"
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
            onClick={() => insertSnippet(`{{ prompter.Wait(${DEFAULT_WAIT_MS}) }}`)}
            title={`Wait ${DEFAULT_WAIT_MS}ms`}
            style={toolbarButtonStyle}
          >
            Wait
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
              insertSnippet(`{{ rt.PlaySoundClip("${selectedSoundId}", 0, -1, -1) }}`)
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
      <textarea
        ref={textareaRef}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => handleDraftChange(e.target.value)}
        onFocus={onFocus}
        onBlur={handleBlur}
        style={{
          display: "block",
          width: "100%",
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          padding: "8px 10px",
          fontSize: "14px",
          lineHeight: 1.5,
          border: "none",
          outline: "none",
          resize: "vertical",
          background: "var(--app-input-bg)",
          color: "var(--app-text)",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}
