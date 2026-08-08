import { describe, it, expect } from "vitest";
import { defaultParamsForDef, getMacroDef, listMacroDefs, validateParams } from "./index";
import { computeBounds } from "../geom";

describe("sketch macros", () => {
  it("only circle remains as parametric macro", () => {
    expect(listMacroDefs().map((d) => d.id)).toEqual(["mount-hole"]);
    expect(getMacroDef("panel")).toBeUndefined();
    expect(getMacroDef("screen")).toBeUndefined();
  });

  it("circle has diameter only", () => {
    const def = getMacroDef("mount-hole")!;
    expect(def.name).toBe("Circle");
    const p = validateParams(def, {});
    expect(Object.keys(p)).toEqual(["diameterMm"]);
    const paths = def.expand(defaultParamsForDef(def));
    expect(paths).toHaveLength(1);
    expect(computeBounds(paths).maxX - computeBounds(paths).minX).toBeCloseTo(10, 0);
  });
});
