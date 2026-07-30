import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    // jsdom (not "node") — some lib/*.ts modules touch window/localStorage
    // (e.g. lib/colony.ts's celebrated-milestone flag), same SSR-safety
    // pattern as lib/map-prefs.ts/lib/sound-prefs.ts.
    environment: "jsdom",
    include: ["lib/**/*.test.ts", "pb_hooks/**/*.test.js"],
  },
});
