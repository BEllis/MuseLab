import type { ExportTarget } from "../cito/exportTarget";

function safeToken(value: string): string {
  return value.replace(/[^\w]+/g, " ").trim();
}

export function defaultNamespaceForTarget(projectName: string, target: ExportTarget): string {
  const words = safeToken(projectName || "MuseLabProject")
    .split(/\s+/)
    .filter(Boolean);
  if (target === "cs") {
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("") || "MuseLabProject";
  }
  if (target === "py") {
    return words.map((word) => word.toLowerCase()).join("_") || "muselab_project";
  }
  const packageTail = words.map((word) => word.toLowerCase()).join("") || "project";
  return `com.muselab.${packageTail}`;
}

export function namespaceFieldLabel(target: ExportTarget): string {
  if (target === "java") return "Package name";
  if (target === "py") return "Module name";
  return "Namespace";
}
