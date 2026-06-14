import { create } from "zustand";

interface PwaState {
  isOffline: boolean;
  updateAvailable: boolean;
  applyUpdate: (() => void) | null;
  setOffline: (offline: boolean) => void;
  setUpdateAvailable: (applyUpdate: () => void) => void;
  clearUpdateAvailable: () => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  updateAvailable: false,
  applyUpdate: null,
  setOffline: (offline) => set({ isOffline: offline }),
  setUpdateAvailable: (applyUpdate) => set({ updateAvailable: true, applyUpdate }),
  clearUpdateAvailable: () => set({ updateAvailable: false, applyUpdate: null }),
}));
