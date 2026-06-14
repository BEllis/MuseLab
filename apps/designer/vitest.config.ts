import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, "public"),
  test: {
    environment: "node",
    exclude: ["e2e/**", "**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
