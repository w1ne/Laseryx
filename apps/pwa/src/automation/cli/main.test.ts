import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
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
});
