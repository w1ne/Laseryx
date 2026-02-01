/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "dev"),
    __GIT_SHA__: JSON.stringify(
      process.env.GITHUB_REF_NAME || // e.g. v1.1.0
      process.env.GITHUB_SHA?.substring(0, 7) || // e.g. a1b2c3d
      (() => {
        try {
          const { execSync } = require("child_process");
          return execSync("git describe --tags --always --dirty").toString().trim();
        } catch {
          return "dev";
        }
      })()
    )
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    reporters: "default"
  }
});
