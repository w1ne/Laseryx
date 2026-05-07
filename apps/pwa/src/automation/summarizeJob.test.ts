import { describe, expect, it } from "vitest";
import minimalJob from "./fixtures/minimal-job.json";
import { summarizeJob } from "./summarizeJob";
import { validateJob } from "./validateJob";

describe("summarizeJob", () => {
  it("returns a stable summary for the minimal fixture", () => {
    const validation = validateJob(minimalJob);
    expect(validation.ok).toBe(true);

    const summary = summarizeJob(validation.job!);

    expect(summary).toEqual({
      document: {
        version: 1,
        units: "mm",
        layerCount: 1,
        objectCount: 1,
        objectsByKind: { shape: 1, path: 0, image: 0 },
        visibleLayerCount: 1
      },
      cam: {
        operationCount: 1,
        operations: [
          {
            id: "op-1",
            name: "Cut",
            mode: "line",
            speed: 1000,
            power: 80,
            passes: 1
          }
        ],
        optimizePaths: true
      },
      machine: {
        id: "default-machine",
        name: "Default Machine",
        bedMm: { w: 400, h: 400 },
        origin: "frontLeft",
        laserMode: "M3",
        baudRate: 115200
      }
    });
  });
});
