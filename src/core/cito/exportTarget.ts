export type ExportTarget = "cs" | "py" | "java";

export const EXPORT_TARGETS: ExportTarget[] = ["cs", "py", "java"];

export const EXPORT_TARGET_LABELS: Record<ExportTarget, string> = {
  cs: "C#",
  py: "Python",
  java: "Java",
};

export const EXPORT_TARGET_EXTENSIONS: Record<ExportTarget, string> = {
  cs: ".cs",
  py: ".py",
  java: ".java",
};

export const EXPORT_TARGET_OUTPUT_FILES: Record<ExportTarget, string> = {
  cs: "MuseLabEngine.cs",
  py: "MuseLabEngine.py",
  java: "MuseLabEngine.java",
};

export type CitoTranspileTarget = ExportTarget | "js";
