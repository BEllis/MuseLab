import { create } from "zustand";
import { applyTheme, DEFAULT_THEME, type AppTheme } from "@/core/view/theme";

type ThemeState = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
