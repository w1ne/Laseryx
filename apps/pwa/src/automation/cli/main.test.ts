import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import minimalJob from "../fixtures/minimal-job.json";
import { LocalBrowserBridgeServer } from "./browserBridgeServer";
import { runCli } from "./main";

describe("runCli", () => {
  it("returns JSON for unknown commands", async () => {
    const result = await runCli(["unknown"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0].code).toBe("CLI_ERROR");
  });

  it("returns JSON for invalid input files", async () => {
    const result = await runCli(["inspect", "--input", "/tmp/laseryx-missing-job.json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0].code).toBe("FILE_READ_FAILED");
  });

  it("writes gcode when --gcode-out is provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "laseryx-cli-"));
    const inputPath = join(dir, "job.json");
    const gcodePath = join(dir, "job.gcode");
    await writeFile(inputPath, JSON.stringify(minimalJob), "utf8");

    const result = await runCli(["generate", "--input", inputPath, "--gcode-out", gcodePath]);
    const parsed = JSON.parse(result.stdout);
    const gcode = await readFile(gcodePath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.gcode).toBeUndefined();
    expect(parsed.data.gcodePath).toBe(gcodePath);
    expect(gcode).toContain("G1");
  });

  it("runs a browser command through a local bridge server", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });
    const server = bridge.createHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");

    try {
      const resultPromise = runCli([
        "browser",
        "run",
        "inspect",
        "--bridge",
        `http://127.0.0.1:${address.port}`,
        "--token",
        "dev"
      ]);
      const request = await bridge.takeNextCommand("dev");
      expect(request?.command).toBe("inspect");
      bridge.acceptResponse("dev", {
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: request?.requestId ?? "",
        ok: true,
        command: "inspect",
        data: { summary: { document: { objectCount: 0 } } },
        warnings: [],
        errors: []
      });

      const result = await resultPromise;
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(parsed).toMatchObject({
        ok: true,
        command: "inspect",
        requestId: request?.requestId
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
