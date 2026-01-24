/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "dev"),
    __GIT_SHA__: JSON.stringify(
      (() => {
        try {
          const { execSync } = require("child_process");
          return execSync("git describe --tags --always --dirty").toString().trim();
        } catch {
          return "unknown";
        }
      })()
    )
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    reporters: "default"
  }
});
