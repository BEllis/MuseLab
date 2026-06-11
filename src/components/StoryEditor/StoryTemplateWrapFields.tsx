import { useRef } from "react";
import type { Project, Story } from "@/core/model/types";
import {
  SINGLE_LINE_HEIGHT,
  TemplateCodeEditor,
  type TemplateCodeEditorHandle,
} from "../NodeEditor/templateEditor/TemplateCodeEditor";

type StoryTemplateField = keyof Pick<
  Story,
  "promptStartTemplate" | "promptEndTemplate" | "speakerStartTemplate" | "speakerEndTemplate"
>;

function StoryTemplateFieldRow({
  label,
  description,
  value,
  placeholder,
  project,
  syncKey,
  onChange,
  onBlurCommit,
}: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  project: Project;
  syncKey: string;
  onChange: (next: string) => void;
  onBlurCommit: () => void;
}) {
  const editorRef = useRef<TemplateCodeEditorHandle | null>(null);

  return (
    <label style={{ display: "block", marginBottom: "12px", fontSize: "12px" }}>
      <strong style={{ display: "block", marginBottom: "2px" }}>{label}</strong>
      <span style={{ display: "block", marginBottom: "6px", color: "var(--app-text-muted)" }}>
        {description}
      </span>
      <TemplateCodeEditor
        value={value}
        placeholder={placeholder}
        project={project}
        mode="singleLine"
        minHeight={SINGLE_LINE_HEIGHT}
        maxHeight={SINGLE_LINE_HEIGHT}
        onChange={onChange}
        onBlur={onBlurCommit}
        syncKey={syncKey}
        editorRef={editorRef}
      />
    </label>
  );
}

export function StoryTemplateWrapFields({
  story,
  project,
  onFieldChange,
  flushHistoryCoalesce,
}: {
  story: Story;
  project: Project;
  onFieldChange: (field: StoryTemplateField, value: string | undefined) => void;
  flushHistoryCoalesce: () => void;
}) {
  const fields: Array<{
    field: StoryTemplateField;
    label: string;
    description: string;
    placeholder: string;
  }> = [
    {
      field: "promptStartTemplate",
      label: "Prompt Start",
      description: "Prepended to every scene prompt before rendering.",
      placeholder: "@{ prompter.RevealWordsBegin(2); }",
    },
    {
      field: "promptEndTemplate",
      label: "Prompt End",
      description: "Appended to every scene prompt before rendering.",
      placeholder: "@{ prompter.RevealEnd(); }",
    },
    {
      field: "speakerStartTemplate",
      label: "Speaker Start",
      description: "Prepended to every speaker name before rendering.",
      placeholder: "@Format.BoldStart()",
    },
    {
      field: "speakerEndTemplate",
      label: "Speaker End",
      description: "Appended to every speaker name before rendering.",
      placeholder: "@Format.BoldEnd()",
    },
  ];

  return (
    <div style={{ marginBottom: "16px" }}>
      <strong style={{ display: "block", fontSize: "12px", marginBottom: "8px" }}>
        Prompt &amp; speaker wrappers
      </strong>
      <p style={{ margin: "0 0 10px", fontSize: "11px", color: "var(--app-text-muted)" }}>
        Applied around each scene&apos;s prompt and speaker at playback time. Override per scene by
        starting that prompt with the opposite instruction, e.g.{" "}
        <code style={{ fontSize: "11px" }}>@{"{ prompter.RevealEnd(); }"}</code>.
      </p>
      {fields.map(({ field, label, description, placeholder }) => (
        <StoryTemplateFieldRow
          key={field}
          label={label}
          description={description}
          value={story[field] ?? ""}
          placeholder={placeholder}
          project={project}
          syncKey={`${story.id}:${field}`}
          onChange={(next) => onFieldChange(field, next || undefined)}
          onBlurCommit={flushHistoryCoalesce}
        />
      ))}
    </div>
  );
}
