import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { CitoType, ServiceMethod, ServiceMethodParam } from "@/core/model/types";
import {
  BUILT_IN_SERVICES,
  getBuiltInService,
  isBuiltInServiceId,
  type BuiltInServiceId,
} from "@/core/services/builtInServices";
import { generateServiceCiStub } from "@/core/services/generateServiceCi";
import { CloseButton } from "../CloseButton";
import { AddButton } from "../AddButton";

const PANEL_STYLE: React.CSSProperties = {
  width: "360px",
  borderLeft: "1px solid var(--app-border)",
  padding: "12px",
  background: "var(--app-surface-muted)",
  overflowY: "auto",
  maxHeight: "100vh",
};

const INPUT_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "6px",
  boxSizing: "border-box",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  minHeight: "120px",
  resize: "vertical",
  fontFamily: "monospace",
  fontSize: "11px",
};

const CITO_TYPES: CitoType[] = ["void", "string", "bool", "int", "double"];

function MethodsTable({
  methods,
  readOnly,
  onChange,
}: {
  methods: ServiceMethod[];
  readOnly: boolean;
  onChange?: (methods: ServiceMethod[]) => void;
}) {
  const updateMethod = (index: number, patch: Partial<ServiceMethod>) => {
    if (!onChange) return;
    const next = methods.map((method, i) => (i === index ? { ...method, ...patch } : method));
    onChange(next);
  };

  const updateParam = (methodIndex: number, paramIndex: number, patch: Partial<ServiceMethodParam>) => {
    if (!onChange) return;
    const next = methods.map((method, i) => {
      if (i !== methodIndex) return method;
      const parameters = method.parameters.map((param, j) =>
        j === paramIndex ? { ...param, ...patch } : param
      );
      return { ...method, parameters };
    });
    onChange(next);
  };

  const addMethod = () => {
    onChange?.([
      ...methods,
      { name: "NewMethod", parameters: [], returnType: "void" },
    ]);
  };

  const removeMethod = (index: number) => {
    onChange?.(methods.filter((_, i) => i !== index));
  };

  const addParam = (methodIndex: number) => {
    if (!onChange) return;
    const next = methods.map((method, i) => {
      if (i !== methodIndex) return method;
      return {
        ...method,
        parameters: [...method.parameters, { name: "arg", type: "string" as CitoType }],
      };
    });
    onChange(next);
  };

  const removeParam = (methodIndex: number, paramIndex: number) => {
    if (!onChange) return;
    const next = methods.map((method, i) => {
      if (i !== methodIndex) return method;
      return {
        ...method,
        parameters: method.parameters.filter((_, j) => j !== paramIndex),
      };
    });
    onChange(next);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <strong style={{ fontSize: "12px" }}>Methods</strong>
        {!readOnly && <AddButton onClick={addMethod} title="Add method" />}
      </div>
      {methods.length === 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--app-text-muted)" }}>No methods.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {methods.map((method, methodIndex) => (
            <div
              key={`${method.name}-${methodIndex}`}
              style={{
                border: "1px solid var(--app-border)",
                borderRadius: "6px",
                padding: "8px",
                background: "var(--app-surface)",
              }}
            >
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                <input
                  value={method.name}
                  readOnly={readOnly}
                  onChange={(event) => updateMethod(methodIndex, { name: event.target.value })}
                  style={{ ...INPUT_STYLE, marginTop: 0, flex: 1 }}
                  placeholder="MethodName"
                />
                <select
                  value={method.returnType}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateMethod(methodIndex, { returnType: event.target.value as CitoType })
                  }
                  style={{ padding: "6px", fontSize: "12px" }}
                >
                  {CITO_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeMethod(methodIndex)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--app-text-muted)", marginBottom: "4px" }}>
                Parameters
              </div>
              {method.parameters.map((param, paramIndex) => (
                <div
                  key={`${param.name}-${paramIndex}`}
                  style={{ display: "flex", gap: "6px", marginBottom: "4px" }}
                >
                  <input
                    value={param.name}
                    readOnly={readOnly}
                    onChange={(event) =>
                      updateParam(methodIndex, paramIndex, { name: event.target.value })
                    }
                    style={{ ...INPUT_STYLE, marginTop: 0, flex: 1 }}
                    placeholder="param"
                  />
                  <select
                    value={param.type}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateParam(methodIndex, paramIndex, { type: event.target.value as CitoType })
                    }
                    style={{ padding: "6px", fontSize: "12px" }}
                  >
                    {CITO_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeParam(methodIndex, paramIndex)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--app-text-muted)",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => addParam(methodIndex)}
                  style={{
                    marginTop: "4px",
                    fontSize: "11px",
                    border: "none",
                    background: "transparent",
                    color: "var(--app-accent)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + Add parameter
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ServiceEditorPanel() {
  const selectedServiceId = useProjectStore((s) => s.selectedServiceId);
  const project = useProjectStore((s) => s.project);
  const setSelectedServiceId = useProjectStore((s) => s.setSelectedServiceId);
  const updateService = useProjectStore((s) => s.updateService);
  const updateProject = useProjectStore((s) => s.updateProject);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);

  const builtIn = useMemo(() => {
    if (!selectedServiceId || !isBuiltInServiceId(selectedServiceId)) return null;
    return getBuiltInService(selectedServiceId as BuiltInServiceId);
  }, [selectedServiceId]);

  const customService = useMemo(() => {
    if (!selectedServiceId || isBuiltInServiceId(selectedServiceId)) return null;
    return project.services.find((service) => service.id === selectedServiceId) ?? null;
  }, [selectedServiceId, project.services]);

  if (!selectedServiceId || (!builtIn && !customService)) {
    return null;
  }

  const isBuiltIn = builtIn != null;
  const serviceName = builtIn?.name ?? customService!.name;
  const bindingName = builtIn?.bindingName ?? customService!.bindingName;
  const methods = builtIn?.methods ?? customService!.methods;

  const ciPreview = customService
    ? generateServiceCiStub(customService)
    : builtIn
      ? BUILT_IN_SERVICES.find((entry) => entry.id === builtIn.id)
        ? "(built-in — see src/cito/)"
        : ""
      : "";

  return (
    <aside style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <strong style={{ fontSize: "13px" }}>Service</strong>
        <CloseButton onClick={() => setSelectedServiceId(null)} title="Close" />
      </div>

      {isBuiltIn && (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--app-text-muted)" }}>
          Built-in interface — cannot be modified.
        </p>
      )}

      <label style={{ fontSize: "12px", display: "block", marginBottom: "10px" }}>
        Interface name
        <input
          value={serviceName}
          readOnly={isBuiltIn}
          onChange={(event) => {
            if (!customService) return;
            updateService(customService.id, { name: event.target.value });
          }}
          onBlur={flushHistoryCoalesce}
          style={INPUT_STYLE}
        />
      </label>

      <label style={{ fontSize: "12px", display: "block", marginBottom: "12px" }}>
        Binding name
        <input
          value={bindingName}
          readOnly={isBuiltIn}
          onChange={(event) => {
            if (!customService) return;
            updateService(customService.id, { bindingName: event.target.value });
          }}
          onBlur={flushHistoryCoalesce}
          style={INPUT_STYLE}
          placeholder="gameSave"
        />
      </label>

      <MethodsTable
        methods={methods}
        readOnly={isBuiltIn}
        onChange={
          customService
            ? (next) => updateService(customService.id, { methods: next })
            : undefined
        }
      />

      {customService && (
        <label style={{ fontSize: "12px", display: "block", marginTop: "16px" }}>
          TypeScript implementation (preview/player)
          <textarea
            value={customService.typescriptSource ?? ""}
            onChange={(event) =>
              updateService(customService.id, { typescriptSource: event.target.value })
            }
            onBlur={flushHistoryCoalesce}
            style={TEXTAREA_STYLE}
            placeholder="export default { SaveSlot(slotId: number) { ... } }"
          />
          <span style={{ fontSize: "11px", color: "var(--app-text-muted)" }}>
            Optional. When omitted, methods return null/defaults in preview and playback.
          </span>
        </label>
      )}

      {builtIn?.id === "builtin:prompter" && (
        <label style={{ fontSize: "12px", display: "block", marginTop: "16px" }}>
          TypeScript prompt renderer override
          <textarea
            value={project.promptRendererTypescriptSource ?? ""}
            onChange={(event) =>
              updateProject({ promptRendererTypescriptSource: event.target.value })
            }
            onBlur={flushHistoryCoalesce}
            style={TEXTAREA_STYLE}
            placeholder="export default { addLiteral(text) {}, appendResult(v) {}, applyFormat(m) {}, render() { return ''; } }"
          />
        </label>
      )}

      {customService && (
        <div style={{ marginTop: "16px" }}>
          <strong style={{ fontSize: "12px", display: "block", marginBottom: "6px" }}>
            Generated .ci stub
          </strong>
          <pre
            style={{
              margin: 0,
              padding: "8px",
              fontSize: "11px",
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              borderRadius: "6px",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {ciPreview}
          </pre>
        </div>
      )}
    </aside>
  );
}
