import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .mts, not .ts: the package is CommonJS, and a .ts config gets require()d,
// which fails on vitest's ESM-only deps.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror the "@/*" alias from tsconfig so tests import modules by the same
    // specifier the app does.
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
