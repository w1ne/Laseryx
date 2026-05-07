import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist-cli",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/automation/cli/main.ts"),
      formats: ["es"],
      fileName: () => "laseryx.mjs"
    },
    rollupOptions: {
      external: [/^node:/]
    }
  }
});
