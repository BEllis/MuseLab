import { useMemo, useRef } from "react";
import type { Project } from "@/core/model/types";
import { validateDialogueTextIssues } from "@/core/scene/dialogueText";
import {
  SINGLE_LINE_HEIGHT,
  TemplateCodeEditor,
  type TemplateCodeEditorHandle,
} from "./templateEditor/TemplateCodeEditor";

export function DialogueTextField({
  project,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  project: Project;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const editorRef = useRef<TemplateCodeEditorHandle | null>(null);
  const minHeight = multiline ? 64 : SINGLE_LINE_HEIGHT;
  const maxHeight = multiline ? 160 : SINGLE_LINE_HEIGHT;

  const dialogueIssues = useMemo(
    () => validateDialogueTextIssues(value, project),
    [value, project]
  );
  const errorRange = useMemo(() => {
    const ranged = dialogueIssues.find(
      (issue) => typeof issue.from === "number" && typeof issue.to === "number"
    );
    if (!ranged || ranged.from == null || ranged.to == null) return null;
    return { from: ranged.from, to: ranged.to, message: ranged.message };
  }, [dialogueIssues]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: multiline ? "220px" : "180px",
        border: `1px solid ${
          dialogueIssues.length > 0
            ? "#b45309"
            : "var(--app-input-border, var(--app-border))"
        }`,
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--app-input-bg, var(--app-panel))",
      }}
    >
      <TemplateCodeEditor
        mode={multiline ? "template" : "singleLine"}
        project={project}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        syncKey={`${multiline ? "multi" : "single"}:${placeholder}`}
        editorRef={editorRef}
        minHeight={minHeight}
        maxHeight={maxHeight}
        errorRange={errorRange}
      />
    </div>
  );
}
