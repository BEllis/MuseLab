import { create } from "zustand";
import { applyTheme, readStoredTheme, type AppTheme } from "@/core/view/theme";

type ThemeState = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
