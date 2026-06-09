import { useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { AddButton } from "./AddButton";
import { BUILT_IN_MODULES } from "@/core/modules/builtInModules";

function selectedRowStyle(selected: boolean): React.CSSProperties {
  return selected
    ? {
        background: "var(--app-accent-subtle, rgba(59, 130, 246, 0.12))",
        outline: "1px solid var(--app-accent)",
        borderRadius: "6px",
      }
    : {};
}

function ModuleRow({
  label,
  bindingName,
  selected,
  onSelect,
  onDelete,
}: {
  label: string;
  bindingName: string;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <li style={{ marginBottom: "4px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 8px",
          cursor: "pointer",
          ...selectedRowStyle(selected),
        }}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: "11px", color: "var(--app-text-muted)" }}>{bindingName}</div>
        </span>
        {onDelete && (
          <button
            type="button"
            title="Delete module"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--app-text-muted)",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}

export function ModulesPanel() {
  const project = useProjectStore((s) => s.project);
  const selectedModuleId = useProjectStore((s) => s.selectedModuleId);
  const setSelectedModuleId = useProjectStore((s) => s.setSelectedModuleId);
  const addModule = useProjectStore((s) => s.addModule);
  const removeModule = useProjectStore((s) => s.removeModule);

  const customModules = [...project.modules].sort((a, b) => a.name.localeCompare(b.name));

  const handleDelete = useCallback(
    (moduleId: string, name: string) => {
      if (!window.confirm(`Delete module "${name}"?`)) return;
      removeModule(moduleId);
    },
    [removeModule]
  );

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
          Built-in
        </strong>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {BUILT_IN_MODULES.map((service) => (
            <ModuleRow
              key={service.id}
              label={service.name}
              bindingName={service.bindingName}
              selected={selectedModuleId === service.id}
              onSelect={() => setSelectedModuleId(service.id)}
            />
          ))}
        </ul>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <strong style={{ fontSize: "12px" }}>Custom</strong>
          <AddButton onClick={() => addModule()} title="Add module" />
        </div>
        {customModules.length === 0 ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--app-text-muted)" }}>
            No custom modules yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {customModules.map((service) => (
              <ModuleRow
                key={service.id}
                label={service.name}
                bindingName={service.bindingName}
                selected={selectedModuleId === service.id}
                onSelect={() => setSelectedModuleId(service.id)}
                onDelete={() => handleDelete(service.id, service.name)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
