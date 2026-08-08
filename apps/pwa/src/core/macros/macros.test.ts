import { describe, it, expect } from "vitest";
import {
  circleToPolyline,
  defaultParamsForDef,
  expandMacro,
  getMacroDef,
  listMacroDefs,
  validateParams
} from "./index";
import type { MacroObj } from "../model";
import { planCam } from "../cam";
import { computeBounds } from "../geom";

describe("macros", () => {
  it("one hole with diameter only", () => {
    const def = getMacroDef("mount-hole")!;
    const p = validateParams(def, {});
    expect(p.diameterMm).toBe(3);
    expect(Object.keys(p)).toEqual(["diameterMm"]);
    const paths = def.expand(p);
    expect(computeBounds(paths).maxX - computeBounds(paths).minX).toBeCloseTo(3, 1);
  });

  it("frame and cutout are size-only", () => {
    const frame = getMacroDef("panel")!;
    expect(frame.params.map((p) => p.key)).toEqual(["widthMm", "heightMm"]);
    const cut = getMacroDef("screen")!;
    expect(cut.params.map((p) => p.key)).toEqual(["widthMm", "heightMm"]);
    expect(cut.expand(defaultParamsForDef(cut))).toHaveLength(1);
    expect(frame.expand(defaultParamsForDef(frame))).toHaveLength(1);
  });

  it("catalog has three defs", () => {
    expect(listMacroDefs().map((d) => d.id).sort()).toEqual(
      ["mount-hole", "panel", "screen"].sort()
    );
    expect(getMacroDef("button")?.id).toBe("mount-hole");
  });

  it("planCam expands hole", () => {
    const def = getMacroDef("mount-hole")!;
    const obj: MacroObj = {
      kind: "macro",
      id: "h1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      defId: "mount-hole",
      defVersion: def.defVersion,
      params: defaultParamsForDef(def)
    };
    const result = planCam(
      {
        version: 1,
        units: "mm",
        layers: [{ id: "layer-1", name: "Cut", visible: true, locked: false, operationId: "op-1" }],
        objects: [obj]
      },
      { operations: [{ id: "op-1", name: "Cut", mode: "line", speed: 1000, power: 80, passes: 1 }] }
    );
    expect(result.plan.ops[0].paths.length).toBe(1);
  });

  it("circle helper still works", () => {
    expect(circleToPolyline(0, 0, 5).closed).toBe(true);
  });

  it("expandMacro applies transform", () => {
    const def = getMacroDef("mount-hole")!;
    const r = expandMacro({
      kind: "macro",
      id: "m",
      layerId: "l",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      defId: "mount-hole",
      defVersion: def.defVersion,
      params: { diameterMm: 4 }
    });
    expect(r.ok).toBe(true);
  });
});
