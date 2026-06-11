import { create } from "zustand";
import type { ExportTarget } from "@/core/cito/exportTarget";

export type ExportWizardStep = 1 | 2;

type ExportStore = {
  open: boolean;
  step: ExportWizardStep;
  target: ExportTarget | null;
  namespace: string;
  defaultLocale: string;
  isExporting: boolean;
  error: string | null;
  show: () => void;
  hide: () => void;
  setStep: (step: ExportWizardStep) => void;
  setTarget: (target: ExportTarget) => void;
  setNamespace: (namespace: string) => void;
  setDefaultLocale: (locale: string) => void;
  setExporting: (isExporting: boolean) => void;
  setError: (error: string | null) => void;
  resetWizard: () => void;
};

const initialState = {
  open: false,
  step: 1 as ExportWizardStep,
  target: null as ExportTarget | null,
  namespace: "",
  defaultLocale: "",
  isExporting: false,
  error: null as string | null,
};

export const useExportStore = create<ExportStore>((set) => ({
  ...initialState,
  show: () => set({ ...initialState, open: true }),
  hide: () => set({ ...initialState, open: false }),
  setStep: (step) => set({ step }),
  setTarget: (target) => set({ target }),
  setNamespace: (namespace) => set({ namespace }),
  setDefaultLocale: (defaultLocale) => set({ defaultLocale }),
  setExporting: (isExporting) => set({ isExporting }),
  setError: (error) => set({ error }),
  resetWizard: () =>
    set({
      step: 1,
      target: null,
      namespace: "",
      defaultLocale: "",
      isExporting: false,
      error: null,
    }),
}));
