import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stale/parallel checkouts and non-TS build scripts -- not real repo
    // source, but linted as if they were without this.
    ".claude/worktrees/**",
    ".claude/skills/**/*.cjs",
  ]),
]);

export default eslintConfig;
