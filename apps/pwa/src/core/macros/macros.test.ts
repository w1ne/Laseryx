import { describe, it, expect } from "vitest";
import { defaultParamsForDef, getMacroDef, listMacroDefs, validateParams } from "./index";
import { slotToPolyline } from "./geomHelpers";
import { computeBounds } from "../geom";
import { planCam } from "../cam";

describe("patterns", () => {
  it("catalog has circle, slot, round-rect", () => {
    expect(listMacroDefs().map((d) => d.id).sort()).toEqual(
      ["mount-hole", "round-rect", "slot"].sort()
    );
  });

  it("slot expands to a closed stadium with expected size", () => {
    const def = getMacroDef("slot")!;
    const paths = def.expand(defaultParamsForDef(def));
    expect(paths).toHaveLength(1);
    expect(paths[0].closed).toBe(true);
    const b = computeBounds(paths);
    // default 30 × 6
    expect(b.maxX - b.minX).toBeCloseTo(30, 0);
    expect(b.maxY - b.minY).toBeCloseTo(6, 0);
  });

  it("slotToPolyline degenerates to circle when L ≈ W", () => {
    const path = slotToPolyline(10, 10);
    const b = computeBounds([path]);
    expect(b.maxX - b.minX).toBeCloseTo(10, 0);
    expect(b.maxY - b.minY).toBeCloseTo(10, 0);
  });

  it("round-rect expands", () => {
    const def = getMacroDef("round-rect")!;
    const paths = def.expand(validateParams(def, { widthMm: 40, heightMm: 20, radiusMm: 5 }));
    expect(paths[0].closed).toBe(true);
    const b = computeBounds(paths);
    expect(b.maxX - b.minX).toBeCloseTo(40, 0);
    expect(b.maxY - b.minY).toBeCloseTo(20, 0);
  });

  it("planCam cuts a slot", () => {
    const def = getMacroDef("slot")!;
    const result = planCam(
      {
        version: 1,
        units: "mm",
        layers: [{ id: "l1", name: "Cut", visible: true, locked: false, operationId: "op1" }],
        objects: [
          {
            kind: "macro",
            id: "s1",
            layerId: "l1",
            transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
            defId: "slot",
            defVersion: def.defVersion,
            params: defaultParamsForDef(def)
          }
        ]
      },
      {
        operations: [{ id: "op1", name: "Cut", mode: "line", speed: 1000, power: 80, passes: 1 }],
        optimizePaths: false
      }
    );
    expect(result.plan.ops[0].paths.length).toBe(1);
  });
});
