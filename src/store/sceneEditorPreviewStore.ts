import { create } from "zustand";

type ShowPreviewOptions = {
  locale?: string;
  draftTemplate?: string;
  editingTemplate?: boolean;
};

type SceneEditorPreviewStore = {
  open: boolean;
  locale?: string;
  draftTemplate?: string;
  editingTemplate: boolean;
  showPreview: (options?: ShowPreviewOptions) => void;
  showTemplateEditor: (locale: string, draftTemplate: string) => void;
  hidePreview: () => void;
  updateDraftTemplate: (draftTemplate: string) => void;
};

export const useSceneEditorPreviewStore = create<SceneEditorPreviewStore>((set) => ({
  open: false,
  locale: undefined,
  draftTemplate: undefined,
  editingTemplate: false,
  showPreview: (options) =>
    set({
      open: true,
      locale: options?.locale,
      draftTemplate: options?.draftTemplate,
      editingTemplate: options?.editingTemplate ?? false,
    }),
  showTemplateEditor: (locale, draftTemplate) =>
    set({
      open: true,
      locale,
      draftTemplate,
      editingTemplate: true,
    }),
  hidePreview: () =>
    set({
      open: false,
      locale: undefined,
      draftTemplate: undefined,
      editingTemplate: false,
    }),
  updateDraftTemplate: (draftTemplate) => set({ draftTemplate }),
}));
