import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { AddButton } from "./AddButton";

function selectedRowStyle(selected: boolean): React.CSSProperties {
  return selected
    ? {
        background: "var(--app-accent-subtle, rgba(59, 130, 246, 0.12))",
        outline: "1px solid var(--app-accent)",
        borderRadius: "6px",
      }
    : {};
}

export function StoriesPanel() {
  const project = useProjectStore((s) => s.project);
  const activeStoryId = useProjectStore((s) => s.activeStoryId);
  const setActiveStoryId = useProjectStore((s) => s.setActiveStoryId);
  const addStory = useProjectStore((s) => s.addStory);
  const removeStory = useProjectStore((s) => s.removeStory);
  const updateStory = useProjectStore((s) => s.updateStory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const stories = [...project.stories].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (editingId && !project.stories.some((story) => story.id === editingId)) {
      setEditingId(null);
    }
  }, [editingId, project.stories]);

  const startEdit = useCallback((storyId: string, name: string) => {
    setEditingId(storyId);
    setEditName(name);
  }, []);

  const commitEdit = useCallback(
    (storyId: string) => {
      const trimmed = editName.trim();
      const story = project.stories.find((entry) => entry.id === storyId);
      if (!story) {
        setEditingId(null);
        return;
      }
      if (trimmed && trimmed !== story.name) {
        updateStory(storyId, { name: trimmed });
      }
      setEditingId(null);
    },
    [editName, project.stories, updateStory]
  );

  const handleDelete = useCallback(
    (storyId: string, name: string) => {
      if (project.stories.length <= 1) return;
      if (!window.confirm(`Delete story "${name}" and all of its scenes?`)) return;
      removeStory(storyId);
    },
    [project.stories.length, removeStory]
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <strong style={{ fontSize: "12px" }}>Stories</strong>
        <AddButton onClick={() => addStory()} title="Add story" />
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {stories.map((story) => {
          const selected = story.id === activeStoryId;
          const isEditing = editingId === story.id;
          return (
            <li
              key={story.id}
              style={{
                marginBottom: "6px",
                padding: "6px 8px",
                cursor: "pointer",
                ...selectedRowStyle(selected),
              }}
              onClick={() => setActiveStoryId(story.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitEdit(story.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "4px 6px",
                      fontSize: "12px",
                      border: "1px solid var(--app-border)",
                      borderRadius: "4px",
                      background: "var(--app-input-bg)",
                      color: "var(--app-text)",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(story.id, story.name);
                    }}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: "12px",
                      color: "var(--app-text)",
                      cursor: "text",
                    }}
                  >
                    {story.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(story.id, story.name);
                  }}
                  disabled={project.stories.length <= 1}
                  title="Delete story"
                  className="app-icon-button"
                  style={{
                    width: "22px",
                    height: "22px",
                    fontSize: "14px",
                    lineHeight: 1,
                    opacity: project.stories.length <= 1 ? 0.4 : 1,
                  }}
                  aria-label="Delete story"
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "11px",
                  color: "var(--app-text-muted)",
                }}
              >
                {story.nodes.length} scene{story.nodes.length === 1 ? "" : "s"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
