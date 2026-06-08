import { create } from "zustand";

type ShowPreviewOptions = {
  locale?: string;
  draftTemplate?: string;
};

type SceneEditorPreviewStore = {
  open: boolean;
  locale?: string;
  draftTemplate?: string;
  showPreview: (options?: ShowPreviewOptions) => void;
  hidePreview: () => void;
  updateDraftTemplate: (draftTemplate: string) => void;
};

export const useSceneEditorPreviewStore = create<SceneEditorPreviewStore>((set) => ({
  open: false,
  locale: undefined,
  draftTemplate: undefined,
  showPreview: (options) =>
    set({
      open: true,
      locale: options?.locale,
      draftTemplate: options?.draftTemplate,
    }),
  hidePreview: () =>
    set({
      open: false,
      locale: undefined,
      draftTemplate: undefined,
    }),
  updateDraftTemplate: (draftTemplate) => set({ draftTemplate }),
}));
