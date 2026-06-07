import { create } from "zustand";

type AboutStore = {
  open: boolean;
  show: () => void;
  hide: () => void;
};

export const useAboutStore = create<AboutStore>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
