import { useMemo, useState } from "react";
import type { Project } from "@/core/model/types";
import {
  createSceneAction,
  sceneActionGroup,
  SCENE_ACTION_KINDS,
  type SceneAction,
  type SceneActionGroup,
  type SceneActionKind,
} from "@/core/scene/actions";
import {
  SCENE_ACTION_GROUP_ORDER,
  sceneActionGroupLabel,
  sceneActionLabel,
} from "@/core/scene/actionLabels";
import { validateSceneActions } from "@/core/scene/validateActions";
import { ActionPill } from "./ActionPill";

export type ActionPillEditorProps = {
  actions: SceneAction[];
  onChange: (actions: SceneAction[]) => void;
  onCommit?: () => void;
  project: Project;
  locale: string;
  onLocaleChange: (locale: string) => void;
  style?: React.CSSProperties;
};

const KINDS_BY_GROUP = SCENE_ACTION_GROUP_ORDER.map((group) => ({
  group,
  kinds: SCENE_ACTION_KINDS.filter((kind) => sceneActionGroup(kind) === group),
}));

/** Prop ids that exist at each index, so id pickers only offer live props. */
function propContext(actions: SceneAction[]): {
  knownIdsAt: string[][];
  assetIdsAt: Record<string, string>[];
} {
  const knownIdsAt: string[][] = [];
  const assetIdsAt: Record<string, string>[] = [];
  const live = new Map<string, string>();

  for (const action of actions) {
    knownIdsAt.push([...live.keys()]);
    assetIdsAt.push(Object.fromEntries(live));
    if (action.kind === "prop.add") live.set(action.id, action.assetId);
    if (action.kind === "prop.remove") live.delete(action.id);
  }

  return { knownIdsAt, assetIdsAt };
}

export function ActionPillEditor({
  actions,
  onChange,
  onCommit,
  project,
  locale,
  onLocaleChange,
  style,
}: ActionPillEditorProps) {
  const [openGroup, setOpenGroup] = useState<SceneActionGroup | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const issues = useMemo(
    () => validateSceneActions(actions, { project }),
    [actions, project]
  );
  const issuesByIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const issue of issues) {
      const list = map.get(issue.index) ?? [];
      list.push(issue.message);
      map.set(issue.index, list);
    }
    return map;
  }, [issues]);
  const { knownIdsAt, assetIdsAt } = useMemo(() => propContext(actions), [actions]);

  const appendAction = (kind: SceneActionKind) => {
    onChange([...actions, createSceneAction(kind)]);
    onCommit?.();
    setOpenGroup(null);
  };

  const replaceAction = (index: number, action: SceneAction) => {
    onChange(actions.map((existing, i) => (i === index ? action : existing)));
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
    onCommit?.();
  };

  const moveAction = (from: number, to: number) => {
    if (from === to) return;
    const next = [...actions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    onCommit?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: "8px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {KINDS_BY_GROUP.map(({ group, kinds }) => (
          <div key={group} style={{ position: "relative" }}>
            <button
              type="button"
              className="app-toolbar-button"
              aria-expanded={openGroup === group}
              onClick={() => setOpenGroup(openGroup === group ? null : group)}
              style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px" }}
            >
              + {sceneActionGroupLabel(group)}
            </button>
            {openGroup === group && (
              <ul
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 5,
                  margin: 0,
                  padding: "4px",
                  listStyle: "none",
                  minWidth: "180px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  borderRadius: "8px",
                  border: "1px solid var(--app-border)",
                  background: "var(--app-surface)",
                  boxShadow: "0 8px 24px var(--app-shadow)",
                }}
              >
                {kinds.map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => appendAction(kind)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "5px 8px",
                        border: "none",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "var(--app-text)",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {sceneActionLabel(kind)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <div style={{ marginLeft: "auto" }}>
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
            aria-label="Locale"
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--app-border)",
              background: "var(--app-surface)",
              color: "var(--app-text)",
              fontSize: "12px",
              fontFamily: "inherit",
            }}
          >
            {project.locales.map((entry) => (
              <option key={entry.id} value={entry.locale}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
        onDragEnd={() => {
          setDragIndex(null);
          setDropIndex(null);
        }}
      >
        {actions.length === 0 && (
          <li style={{ fontSize: "13px", color: "var(--app-text-muted, #64748b)", padding: "8px 2px" }}>
            No actions yet. Use the buttons above to script this scene.
          </li>
        )}
        {actions.map((action, index) => (
          <ActionPill
            key={index}
            action={action}
            index={index}
            project={project}
            knownPropIds={knownIdsAt[index] ?? []}
            propAssetIds={assetIdsAt[index] ?? {}}
            issues={issuesByIndex.get(index) ?? []}
            onChange={(next) => replaceAction(index, next)}
            onRemove={() => removeAction(index)}
            onDragStart={() => setDragIndex(index)}
            onDragOver={() => setDropIndex(index)}
            onDrop={() => {
              if (dragIndex !== null) moveAction(dragIndex, index);
              setDragIndex(null);
              setDropIndex(null);
            }}
            isDragging={dragIndex === index}
            isDropTarget={dropIndex === index && dragIndex !== null && dragIndex !== index}
          />
        ))}
      </ul>
    </div>
  );
}
