import { useCallback, useEffect, useRef, useState } from "react";

const COMMIT_IDLE_MS = 700;

const toolbarButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid var(--app-border)",
  borderRadius: "4px",
  background: "var(--app-surface)",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: "13px",
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

export function TemplateTextEditor({
  value,
  onChange,
  onBlurCommit,
  onFocus,
  onDraftChange,
  syncKey,
  placeholder = "",
  style,
}: {
  value: string;
  onChange: (markup: string) => void;
  onBlurCommit?: () => void;
  onFocus?: () => void;
  onDraftChange?: (draft: string) => void;
  syncKey: string | undefined;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? "");
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
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
      el.focus();
      const cursor = el.selectionStart;
      el.setSelectionRange(cursor, cursor);
    },
    [commit, onDraftChange]
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
      setDraft(next);
      onDraftChange?.(next);
      commit(next);
      el.focus();
    },
    [commit, onDraftChange]
  );

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: "6px", overflow: "hidden", ...style }}>
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
      </div>
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
          minHeight: "120px",
          maxHeight: "280px",
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
