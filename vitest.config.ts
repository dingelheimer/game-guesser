import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/types/**", "src/tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only throws at import time in non-RSC bundler contexts.
      // Map it to an empty module so server-side utilities can be tested.
      "server-only": path.resolve(__dirname, "./src/tests/mocks/server-only.ts"),
    },
  },
});
