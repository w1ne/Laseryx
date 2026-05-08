import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist-hosted-mcp",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/automation/session/httpMcpServer.ts"),
      formats: ["es"],
      fileName: () => "laseryx-hosted-mcp.mjs"
    },
    rollupOptions: {
      external: [/^node:/]
    }
  }
});
