import { create } from "zustand";
import {
  type AspectRatio,
  readStoredThumbnailAspectRatio,
  storeThumbnailAspectRatio,
} from "@/core/view/thumbnailAspectRatio";

type DesignerState = {
  thumbnailAspectRatio: AspectRatio;
  setThumbnailAspectRatio: (ratio: AspectRatio) => void;
};

export const useDesignerStore = create<DesignerState>((set) => ({
  thumbnailAspectRatio: readStoredThumbnailAspectRatio(),
  setThumbnailAspectRatio: (ratio) => {
    storeThumbnailAspectRatio(ratio);
    set({ thumbnailAspectRatio: ratio });
  },
}));
