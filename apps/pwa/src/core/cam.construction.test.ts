import { describe, it, expect } from "vitest";
import { planCam } from "./cam";
import type { Document } from "./model";

describe("construction geometry", () => {
  it("does not cut construction objects", () => {
    const document: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "layer-1", name: "Cut", visible: true, locked: false, operationId: "op-1" }],
      objects: [
        {
          kind: "shape",
          id: "cut-rect",
          layerId: "layer-1",
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          shape: { type: "rect", width: 10, height: 10 }
        },
        {
          kind: "path",
          id: "guide",
          layerId: "layer-1",
          closed: false,
          construction: true,
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 }
          ]
        },
        {
          kind: "shape",
          id: "guide-rect",
          layerId: "layer-1",
          construction: true,
          transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 },
          shape: { type: "rect", width: 5, height: 5 }
        }
      ]
    };

    const result = planCam(document, {
      operations: [{ id: "op-1", name: "Cut", mode: "line", speed: 1000, power: 80, passes: 1 }],
      optimizePaths: false
    });

    // Only the non-construction rect → 1 closed path
    expect(result.plan.ops[0].paths).toHaveLength(1);
  });
});
