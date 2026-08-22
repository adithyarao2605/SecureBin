import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// ponytail: native .env loading; swap for a lib only if overrides/env stacking is ever needed
try {
  process.loadEnvFile();
} catch {
  // No .env file present (e.g. CI) - explicit env vars are used instead.
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
