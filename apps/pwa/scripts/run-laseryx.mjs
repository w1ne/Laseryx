import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(appRoot, "dist-cli", ".build.lock");

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
      } else {
        resolve(code ?? 1);
      }
    });
  });
}

async function waitForBuildLock() {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      await mkdir(dirname(lockPath), { recursive: true });
      await mkdir(lockPath, { recursive: false });
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Timed out waiting for Laseryx CLI build lock");
}

async function main() {
  await waitForBuildLock();
  try {
    const buildCode = await run("npm", ["run", "cli:build", "--silent"]);
    if (buildCode !== 0) return buildCode;
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }

  return await run(process.execPath, [join(appRoot, "dist-cli", "laseryx.mjs"), ...process.argv.slice(2)]);
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
