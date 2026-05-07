import { describe, expect, it } from "vitest";
import minimalJob from "./fixtures/minimal-job.json";
import { validateJob } from "./validateJob";

describe("validateJob", () => {
  it("accepts the minimal job fixture", () => {
    const result = validateJob(minimalJob);

    expect(result.ok).toBe(true);
    expect(result.job?.document.objects).toHaveLength(1);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects missing top-level fields", () => {
    const result = validateJob({ document: minimalJob.document });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        severity: "error",
        message: "Missing camSettings"
      })
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "INVALID_INPUT",
        severity: "error",
        message: "Missing machineProfile"
      })
    );
  });

  it("rejects invalid machine dimensions", () => {
    const result = validateJob({
      ...minimalJob,
      machineProfile: {
        ...minimalJob.machineProfile,
        bedMm: { w: 0, h: 400 }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "INVALID_MACHINE",
        severity: "error",
        message: "Machine bed dimensions must be positive"
      })
    );
  });
});
