import { useCallback, useEffect, useRef } from "react";
import { EditorState, type Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import type { Project } from "@/core/model/types";
import { templateEditorTheme } from "./templateEditorTheme";
import { templateSyntaxHighlighting } from "./templateLanguage";
import { foldKeymap } from "@codemirror/language";
import { templateFolding } from "./templateFolding";
import {
  buildTemplateCompletionModules,
  templateCompletionSource,
} from "./templateCompletions";
import { applyDefaultTemplateFolds } from "./applyDefaultFolds";
import { templateWhitespace } from "./templateWhitespace";
import {
  setTemplateError,
  templateErrorHighlight,
  type TemplateErrorRange,
} from "./templateErrorHighlight";

export type TemplateCodeEditorHandle = {
  getView: () => EditorView | null;
};

export type TemplateCodeEditorMode = "template" | "singleLine";

const SINGLE_LINE_HEIGHT = 36;

const singleLineTransactionFilter = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged) return tr;
  const next = tr.newDoc.toString();
  if (!/[\r\n]/.test(next)) return tr;
  const stripped = next.replace(/[\r\n]+/g, " ");
  return [
    {
      changes: { from: 0, to: tr.startState.doc.length, insert: stripped },
      selection: tr.selection,
    },
  ];
});

const singleLineEditorTheme = EditorView.theme({
  ".cm-content": {
    padding: "6px 8px",
  },
  ".cm-scroller": {
    overflow: "hidden",
  },
});

function buildEditorExtensions(mode: TemplateCodeEditorMode) {
  const extensions = [
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...(mode === "template" ? foldKeymap : []),
      ...(mode === "singleLine" ? [{ key: "Enter", run: () => true }] : []),
    ]),
    templateEditorTheme,
    ...templateSyntaxHighlighting(),
  ];

  if (mode === "template") {
    extensions.push(
      templateFolding(),
      ...templateWhitespace(),
      templateErrorHighlight(),
      EditorView.lineWrapping,
    );
  } else {
    extensions.push(singleLineTransactionFilter, singleLineEditorTheme, EditorView.lineWrapping);
  }

  return extensions;
}

export function TemplateCodeEditor({
  value,
  placeholder = "",
  project,
  mode = "template",
  minHeight,
  maxHeight,
  onChange,
  onFocus,
  onBlur,
  syncKey,
  editorRef,
  errorRange,
}: {
  value: string;
  placeholder?: string;
  project: Project;
  mode?: TemplateCodeEditorMode;
  minHeight: number;
  maxHeight: number;
  onChange: (next: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  syncKey: string | undefined;
  editorRef: React.MutableRefObject<TemplateCodeEditorHandle | null>;
  errorRange?: TemplateErrorRange | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const projectRef = useRef(project);
  const lastSyncKeyRef = useRef(syncKey);
  const appliedDefaultFoldsRef = useRef(false);

  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;
  onBlurRef.current = onBlur;
  projectRef.current = project;

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const state = EditorState.create({
      doc: value ?? "",
      extensions: [
        ...buildEditorExtensions(mode),
        autocompletion({
          activateOnTyping: true,
          override: [
            (context) =>
              templateCompletionSource(buildTemplateCompletionModules(projectRef.current))(context),
          ],
        }),
        cmPlaceholder(placeholder),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.focusChanged) {
            if (update.view.hasFocus) onFocusRef.current?.();
            else onBlurRef.current?.();
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;
    editorRef.current = { getView: () => viewRef.current };

    if (mode === "template") {
      requestAnimationFrame(() => {
        if (!appliedDefaultFoldsRef.current && viewRef.current) {
          applyDefaultTemplateFolds(viewRef.current);
          appliedDefaultFoldsRef.current = true;
        }
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      editorRef.current = { getView: () => null };
      appliedDefaultFoldsRef.current = false;
    };
  }, [editorRef, mode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const syncKeyChanged = syncKey !== lastSyncKeyRef.current;
    lastSyncKeyRef.current = syncKey;

    const next = value ?? "";
    const current = view.state.doc.toString();
    if (current === next) return;

    // Avoid clobbering in-progress edits when parent store updates lag behind the editor.
    if (view.hasFocus && !syncKeyChanged) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor: Math.min(view.state.selection.main.anchor, next.length) },
    });
    if (syncKeyChanged && mode === "template") {
      appliedDefaultFoldsRef.current = false;
      requestAnimationFrame(() => {
        if (viewRef.current) {
          applyDefaultTemplateFolds(viewRef.current);
          appliedDefaultFoldsRef.current = true;
        }
      });
    }
  }, [mode, syncKey, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || mode !== "template") return;
    setTemplateError(view, errorRange ?? null);
  }, [errorRange, mode]);

  const focusEditorEnd = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const end = view.state.doc.length;
    view.dispatch({
      selection: { anchor: end, head: end },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const handleBelowEditorMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      focusEditorEnd();
    },
    [focusEditorEnd]
  );

  if (mode === "singleLine") {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          overflow: "hidden",
          border: "1px solid var(--app-border)",
          borderRadius: "4px",
        }}
      >
        <div ref={containerRef} />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "auto",
        }}
      >
        <div ref={containerRef} />
        <div
          role="presentation"
          onMouseDown={handleBelowEditorMouseDown}
          style={{
            flex: 1,
            minHeight: "24px",
            cursor: "text",
          }}
        />
      </div>
    </div>
  );
}

export { SINGLE_LINE_HEIGHT };
