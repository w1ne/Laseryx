import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const launcher = join(repoRoot, "apps", "pwa", "scripts", "run-laseryx-mcp.mjs");

const child = spawn(process.execPath, [launcher], {
  cwd: repoRoot,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
