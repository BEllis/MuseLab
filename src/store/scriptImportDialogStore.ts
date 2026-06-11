import { create } from "zustand";

type ScriptImportDialogStore = {
  open: boolean;
  success: boolean;
  reasons: string[];
  showSuccess: (notes?: string[]) => void;
  showFailure: (reasons: string[]) => void;
  hide: () => void;
};

export const useScriptImportDialogStore = create<ScriptImportDialogStore>((set) => ({
  open: false,
  success: false,
  reasons: [],
  showSuccess: (notes = []) =>
    set({
      open: true,
      success: true,
      reasons: notes.filter(Boolean),
    }),
  showFailure: (reasons) =>
    set({
      open: true,
      success: false,
      reasons: reasons.filter(Boolean).length > 0 ? reasons.filter(Boolean) : ["Unknown error"],
    }),
  hide: () => set({ open: false, success: false, reasons: [] }),
}));
