import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const config = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Existing effects synchronize browser-only state, object URLs, and
      // lifecycle polling. Refactor them separately from framework upgrades.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "info/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default config;
