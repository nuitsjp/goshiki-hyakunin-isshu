import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup-console.js"],
    silent: true,
    reporter: ["dot"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      exclude: ["src/js/debug.js"]
    }
  }
});
