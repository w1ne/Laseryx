import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist-mcp",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/automation/mcp/main.ts"),
      formats: ["es"],
      fileName: () => "laseryx-mcp.mjs"
    },
    rollupOptions: {
      external: [/^node:/]
    }
  }
});
