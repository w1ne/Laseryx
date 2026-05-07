import { describe, expect, it } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
import { generateCommand } from "./generate";
import { inspectCommand } from "./inspect";
import { preflightCommand } from "./preflight";

describe("automation commands", () => {
  it("inspects a valid job", () => {
    const response = inspectCommand(minimalJob);

    expect(response.ok).toBe(true);
    expect(response.command).toBe("inspect");
    expect(response.data?.summary.document.objectCount).toBe(1);
    expect(response.errors).toEqual([]);
  });

  it("preflights a valid job", () => {
    const response = preflightCommand(minimalJob);

    expect(response.ok).toBe(true);
    expect(response.data?.ready).toBe(true);
    expect(response.errors).toEqual([]);
  });

  it("preflights an empty document as not ready", () => {
    const response = preflightCommand({
      ...minimalJob,
      document: { ...minimalJob.document, objects: [] }
    });

    expect(response.ok).toBe(true);
    expect(response.data?.ready).toBe(false);
    expect(response.warnings).toContainEqual(
      expect.objectContaining({
        code: "EMPTY_DOCUMENT",
        severity: "warning",
        message: "Document has no objects"
      })
    );
  });

  it("generates gcode for a valid job", () => {
    const response = generateCommand(minimalJob);

    expect(response.ok).toBe(true);
    expect(response.command).toBe("generate");
    expect(response.data?.gcode).toContain("G1");
    expect(response.data?.stats.segments).toBeGreaterThan(0);
    expect(response.errors).toEqual([]);
  });

  it("omits gcode from generate responses when requested", () => {
    const response = generateCommand(minimalJob, { includeGcode: false });

    expect(response.ok).toBe(true);
    expect(response.data?.gcode).toBeUndefined();
    expect(response.data?.stats.segments).toBeGreaterThan(0);
  });
});
