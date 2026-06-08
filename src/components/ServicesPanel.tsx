import { useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { AddButton } from "./AddButton";
import { BUILT_IN_SERVICES } from "@/core/services/builtInServices";

function selectedRowStyle(selected: boolean): React.CSSProperties {
  return selected
    ? {
        background: "var(--app-accent-subtle, rgba(59, 130, 246, 0.12))",
        outline: "1px solid var(--app-accent)",
        borderRadius: "6px",
      }
    : {};
}

function ServiceRow({
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
            title="Delete service"
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

export function ServicesPanel() {
  const project = useProjectStore((s) => s.project);
  const selectedServiceId = useProjectStore((s) => s.selectedServiceId);
  const setSelectedServiceId = useProjectStore((s) => s.setSelectedServiceId);
  const addService = useProjectStore((s) => s.addService);
  const removeService = useProjectStore((s) => s.removeService);

  const customServices = [...project.services].sort((a, b) => a.name.localeCompare(b.name));

  const handleDelete = useCallback(
    (serviceId: string, name: string) => {
      if (!window.confirm(`Delete service "${name}"?`)) return;
      removeService(serviceId);
    },
    [removeService]
  );

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
          Built-in
        </strong>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {BUILT_IN_SERVICES.map((service) => (
            <ServiceRow
              key={service.id}
              label={service.name}
              bindingName={service.bindingName}
              selected={selectedServiceId === service.id}
              onSelect={() => setSelectedServiceId(service.id)}
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
          <AddButton onClick={() => addService()} title="Add service" />
        </div>
        {customServices.length === 0 ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--app-text-muted)" }}>
            No custom services yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {customServices.map((service) => (
              <ServiceRow
                key={service.id}
                label={service.name}
                bindingName={service.bindingName}
                selected={selectedServiceId === service.id}
                onSelect={() => setSelectedServiceId(service.id)}
                onDelete={() => handleDelete(service.id, service.name)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
