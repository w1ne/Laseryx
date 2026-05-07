import { describe, expect, it } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
import { createBrowserAutomation, installBrowserAutomation } from "./browserAutomation";

describe("browserAutomation", () => {
  it("runs inspect against the live job provider", () => {
    const api = createBrowserAutomation(() => minimalJob);
    const response = api.inspect();

    expect(response.ok).toBe(true);
    expect(response.data?.summary.document.objectCount).toBe(1);
  });

  it("runs generate against the live job provider", () => {
    const api = createBrowserAutomation(() => minimalJob);
    const response = api.generate();

    expect(response.ok).toBe(true);
    expect(response.data?.gcode).toContain("G1");
  });

  it("installs and cleans up a browser global", () => {
    const target: { laseryx?: unknown } = {};
    const cleanup = installBrowserAutomation(() => minimalJob, target);

    expect(target.laseryx).toBeDefined();
    cleanup();
    expect(target.laseryx).toBeUndefined();
  });
});
