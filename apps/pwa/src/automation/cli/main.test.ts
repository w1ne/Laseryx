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

  it("includes gcode in stdout when generating without an output path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "laseryx-cli-"));
    const inputPath = join(dir, "job.json");
    await writeFile(inputPath, JSON.stringify(minimalJob), "utf8");

    const result = await runCli(["generate", "--input", inputPath]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.gcode).toContain("G1");
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

  it("returns browser bridge status as JSON", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });
    const server = bridge.createHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");

    try {
      const result = await runCli([
        "browser",
        "status",
        "--bridge",
        `http://127.0.0.1:${address.port}`,
        "--token",
        "dev"
      ]);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(parsed).toMatchObject({
        ok: true,
        attached: false,
        state: "detached"
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it("prints an attach URL for the browser bridge", async () => {
    const result = await runCli([
      "browser",
      "attach-url",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev token",
      "--app",
      "http://localhost:5173/workbench"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("http://localhost:5173/workbench?laseryxBridge=http%3A%2F%2F127.0.0.1%3A17321&laseryxToken=dev+token");
  });

  it("prints a browser link command URL", async () => {
    const result = await runCli([
      "browser",
      "link",
      "document.addRect",
      "--app",
      "https://laseryx.com/workbench",
      "--title",
      "Linked rectangle",
      "--object",
      "rect-link-1",
      "--layer",
      "layer-1",
      "--width",
      "40",
      "--height",
      "20"
    ]);

    expect(result.exitCode).toBe(0);
    const url = new URL(result.stdout.trim());
    expect(url.origin + url.pathname).toBe("https://laseryx.com/workbench");
    const encoded = new URLSearchParams(url.hash.slice(1)).get("lx");
    expect(encoded).toBeTruthy();
    const capsule = JSON.parse(Buffer.from(encoded!, "base64url").toString("utf8"));
    expect(capsule).toEqual({
      version: 1,
      title: "Linked rectangle",
      commands: [{
        command: "document.addRect",
        args: {
          object: "rect-link-1",
          layer: "layer-1",
          width: 40,
          height: 20
        }
      }]
    });
  });

  it("rejects browser link commands that are not link-safe", async () => {
    const result = await runCli([
      "browser",
      "link",
      "project.delete",
      "--id",
      "project-1"
    ]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(parsed.errors[0].message).toBe("Command not allowed in links: project.delete");
  });
});
