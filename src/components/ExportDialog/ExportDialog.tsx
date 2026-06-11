import { useEffect, useMemo } from "react";
import {
  EXPORT_TARGETS,
  EXPORT_TARGET_LABELS,
  type ExportTarget,
} from "@/core/cito/exportTarget";
import { defaultNamespaceForTarget, namespaceFieldLabel } from "@/core/export/exportDefaults";
import { runProjectExport } from "@/core/export/exportFileActions";
import { getDefaultLocaleTag, normalizeLocaleTags } from "@/core/locale/localeTag";
import { useExportStore } from "@/store/exportStore";
import { useProjectStore } from "@/store/projectStore";
import "./ExportDialog.css";

export function ExportDialog() {
  const open = useExportStore((s) => s.open);
  const hide = useExportStore((s) => s.hide);
  const step = useExportStore((s) => s.step);
  const target = useExportStore((s) => s.target);
  const namespace = useExportStore((s) => s.namespace);
  const defaultLocale = useExportStore((s) => s.defaultLocale);
  const isExporting = useExportStore((s) => s.isExporting);
  const error = useExportStore((s) => s.error);
  const setStep = useExportStore((s) => s.setStep);
  const setTarget = useExportStore((s) => s.setTarget);
  const setNamespace = useExportStore((s) => s.setNamespace);
  const setDefaultLocale = useExportStore((s) => s.setDefaultLocale);
  const setExporting = useExportStore((s) => s.setExporting);
  const setError = useExportStore((s) => s.setError);

  const project = useProjectStore((s) => s.project);
  const localeOptions = useMemo(
    () => normalizeLocaleTags(project.locales),
    [project.locales]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hide, isExporting]);

  useEffect(() => {
    if (!open) return;
    if (!defaultLocale && localeOptions.length > 0) {
      setDefaultLocale(getDefaultLocaleTag(project.locales) ?? localeOptions[0]);
    }
  }, [open, defaultLocale, localeOptions, project.locales, setDefaultLocale]);

  useEffect(() => {
    if (!target) return;
    if (!namespace) {
      setNamespace(defaultNamespaceForTarget(project.name, target));
    }
  }, [target, namespace, project.name, setNamespace]);

  if (!open) return null;

  const handleSelectTarget = (nextTarget: ExportTarget) => {
    setTarget(nextTarget);
    setNamespace(defaultNamespaceForTarget(project.name, nextTarget));
    setError(null);
  };

  const handleNext = () => {
    if (!target) {
      setError("Choose an export target to continue.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleExport = async () => {
    if (!target) {
      setError("Choose an export target to continue.");
      return;
    }
    if (!namespace.trim()) {
      setError(`${namespaceFieldLabel(target)} is required.`);
      return;
    }
    if (!defaultLocale) {
      setError("Choose a default locale.");
      return;
    }

    setExporting(true);
    setError(null);
    try {
      await runProjectExport({
        target,
        namespace: namespace.trim(),
        defaultLocale,
      });
      hide();
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "Export failed.";
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="export-dialog-overlay"
      onClick={() => {
        if (!isExporting) hide();
      }}
    >
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="export-dialog-title" className="export-dialog-title">
          Export Project
        </h2>
        {step === 1 ? (
          <>
            <p className="export-dialog-subtitle">Choose the language to export your project to.</p>
            <ul className="export-target-list">
              {EXPORT_TARGETS.map((entry) => (
                <li key={entry}>
                  <label
                    className={`export-target-option${target === entry ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="export-target"
                      value={entry}
                      checked={target === entry}
                      onChange={() => handleSelectTarget(entry)}
                    />
                    <span>Export to {EXPORT_TARGET_LABELS[entry]}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="export-dialog-actions">
              <button type="button" className="app-toolbar-button" onClick={hide} disabled={isExporting}>
                Cancel
              </button>
              <button type="button" className="app-toolbar-button" onClick={handleNext} disabled={isExporting}>
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="export-dialog-subtitle">
              Configure export settings for {target ? EXPORT_TARGET_LABELS[target] : "the selected target"}.
            </p>
            <div className="export-dialog-field">
              <label htmlFor="export-namespace">
                {target ? namespaceFieldLabel(target) : "Namespace"}
              </label>
              <input
                id="export-namespace"
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                disabled={isExporting}
              />
            </div>
            <div className="export-dialog-field">
              <label htmlFor="export-locale">Default locale</label>
              <select
                id="export-locale"
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                disabled={isExporting}
              >
                {localeOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale}
                  </option>
                ))}
              </select>
            </div>
            {isExporting && (
              <p className="export-dialog-status">Generating export and transpiling…</p>
            )}
            {error && <p className="export-dialog-error">{error}</p>}
            <div className="export-dialog-actions">
              <button
                type="button"
                className="app-toolbar-button"
                onClick={handleBack}
                disabled={isExporting}
              >
                Back
              </button>
              <button
                type="button"
                className="app-toolbar-button"
                onClick={() => void handleExport()}
                disabled={isExporting}
              >
                Export
              </button>
            </div>
          </>
        )}
        {step === 1 && error && <p className="export-dialog-error">{error}</p>}
      </div>
    </div>
  );
}
