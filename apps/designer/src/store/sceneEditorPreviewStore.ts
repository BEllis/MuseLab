import { create } from "zustand";

type ShowPreviewOptions = {
  locale?: string;
  editingActions?: boolean;
};

type SceneEditorPreviewStore = {
  open: boolean;
  locale?: string;
  /** True when the action pill editor is docked below the preview. */
  editingActions: boolean;
  showPreview: (options?: ShowPreviewOptions) => void;
  showActionEditor: (locale: string) => void;
  switchEditorLocale: (locale: string) => void;
  hidePreview: () => void;
};

export const useSceneEditorPreviewStore = create<SceneEditorPreviewStore>((set) => ({
  open: false,
  locale: undefined,
  editingActions: false,
  showPreview: (options) =>
    set({
      open: true,
      locale: options?.locale,
      editingActions: options?.editingActions ?? false,
    }),
  showActionEditor: (locale) =>
    set({
      open: true,
      locale,
      editingActions: true,
    }),
  switchEditorLocale: (locale) => set({ locale }),
  hidePreview: () =>
    set({
      open: false,
      locale: undefined,
      editingActions: false,
    }),
}));
