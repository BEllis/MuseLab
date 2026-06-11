import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import type { Project } from "@/core/model/types";
import { templateEditorTheme } from "./templateEditorTheme";
import { templateSyntaxHighlighting } from "./templateLanguage";
import { templateFolding } from "./templateFolding";
import {
  buildTemplateCompletionModules,
  templateCompletionSource,
} from "./templateCompletions";
import { applyDefaultTemplateFolds } from "./applyDefaultFolds";
import { templateWhitespace } from "./templateWhitespace";

export type TemplateCodeEditorHandle = {
  getView: () => EditorView | null;
};

const templateEditorExtensions = [
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  templateEditorTheme,
  ...templateSyntaxHighlighting(),
  templateFolding(),
  ...templateWhitespace(),
  EditorView.lineWrapping,
];

export function TemplateCodeEditor({
  value,
  placeholder = "",
  project,
  minHeight,
  maxHeight,
  onChange,
  onFocus,
  onBlur,
  syncKey,
  editorRef,
}: {
  value: string;
  placeholder?: string;
  project: Project;
  minHeight: number;
  maxHeight: number;
  onChange: (next: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  syncKey: string | undefined;
  editorRef: React.MutableRefObject<TemplateCodeEditorHandle | null>;
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
        ...templateEditorExtensions,
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

    requestAnimationFrame(() => {
      if (!appliedDefaultFoldsRef.current && viewRef.current) {
        applyDefaultTemplateFolds(viewRef.current);
        appliedDefaultFoldsRef.current = true;
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
      editorRef.current = { getView: () => null };
      appliedDefaultFoldsRef.current = false;
    };
  }, [editorRef]);

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
    if (syncKeyChanged) {
      appliedDefaultFoldsRef.current = false;
      requestAnimationFrame(() => {
        if (viewRef.current) {
          applyDefaultTemplateFolds(viewRef.current);
          appliedDefaultFoldsRef.current = true;
        }
      });
    }
  }, [syncKey, value]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        overflow: "auto",
        resize: "vertical",
      }}
    />
  );
}
