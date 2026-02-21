import { useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";

const EDITOR_ALLOWED_TAGS = ["b", "i", "strong", "em", "span", "p", "br", "div"];
const EDITOR_ALLOWED_ATTR = ["style"];

/**
 * Simple rich text editor (contentEditable) with Bold, Italic, and Color.
 * Outputs HTML; syncs from value to DOM only when syncKey changes (e.g. node id).
 */
export function RichTextEditor({
  value,
  onChange,
  syncKey,
  placeholder = "",
  style,
}: {
  value: string;
  onChange: (html: string) => void;
  /** When this changes, value is written into the editor (e.g. node id when switching nodes). */
  syncKey: string | undefined;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ anchorNode: Node; anchorOffset: number; focusNode: Node; focusOffset: number } | null>(null);

  const saveSelection = useCallback(() => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    savedSelectionRef.current = {
      anchorNode: sel.anchorNode!,
      anchorOffset: sel.anchorOffset,
      focusNode: sel.focusNode!,
      focusOffset: sel.focusOffset,
    };
  }, []);

  const restoreSelection = useCallback(() => {
    const saved = savedSelectionRef.current;
    if (!saved || !editorRef.current) return false;
    try {
      const sel = document.getSelection();
      if (!sel) return false;
      const range = document.createRange();
      range.setStart(saved.anchorNode, saved.anchorOffset);
      range.setEnd(saved.focusNode, saved.focusOffset);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncKey === undefined) return;
    const safe = value ?? "";
    if (el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
  }, [syncKey, value]);

  const flushContent = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const raw = el.innerHTML;
    const sanitized = sanitizeEditorHtml(raw);
    if (sanitized !== raw) el.innerHTML = sanitized;
    onChange(sanitized);
  }, [onChange]);

  const handleInput = useCallback(() => {
    flushContent();
  }, [flushContent]);

  const applyFormat = useCallback((command: string, value?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    restoreSelection();
    document.execCommand(command, false, value ?? undefined);
    flushContent();
  }, [flushContent, restoreSelection]);

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "6px", overflow: "hidden", ...style }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px",
          background: "#f5f5f5",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button
          type="button"
          onClick={() => applyFormat("bold")}
          title="Bold"
          style={{
            padding: "4px 10px",
            fontWeight: "bold",
            cursor: "pointer",
            border: "1px solid #ccc",
            borderRadius: "4px",
            background: "#fff",
          }}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          title="Italic"
          style={{
            padding: "4px 10px",
            fontStyle: "italic",
            cursor: "pointer",
            border: "1px solid #ccc",
            borderRadius: "4px",
            background: "#fff",
          }}
        >
          I
        </button>
        <span style={{ fontSize: "12px", color: "#666" }}>Color:</span>
        <input
          type="color"
          defaultValue="#000000"
          title="Text color"
          onChange={(e) => applyFormat("foreColor", e.target.value)}
          style={{
            width: "28px",
            height: "28px",
            padding: 0,
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            background: "#fff",
          }}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        data-placeholder={placeholder}
        onInput={handleInput}
        onBlur={() => {
          saveSelection();
          flushContent();
        }}
        style={{
          minHeight: "120px",
          maxHeight: "280px",
          overflowY: "auto",
          padding: "8px 10px",
          fontSize: "14px",
          lineHeight: 1.5,
          outline: "none",
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}

function sanitizeEditorHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EDITOR_ALLOWED_TAGS,
    ALLOWED_ATTR: EDITOR_ALLOWED_ATTR,
  });
}
