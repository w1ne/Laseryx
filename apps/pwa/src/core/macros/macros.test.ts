import { describe, it, expect } from "vitest";
import {
  applyMacroParamUpdate,
  circleToPolyline,
  defaultParamsForDef,
  expandMacro,
  getMacroDef,
  listMacroDefs,
  nextCascadeTransform,
  SCREEN_PRESETS,
  validateParams,
  v1DefIds
} from "./index";
import type { Document, MacroObj } from "../model";
import { planCam } from "../cam";
import { computeBounds } from "../geom";

describe("macros geomHelpers", () => {
  it("circleToPolyline is closed with enough points", () => {
    const path = circleToPolyline(0, 0, 5);
    expect(path.closed).toBe(true);
    expect(path.points.length).toBeGreaterThanOrEqual(24);
  });
});

describe("macros validateParams + preset rules", () => {
  it("fills defaults for mount-hole — diameter only", () => {
    const def = getMacroDef("mount-hole")!;
    const p = validateParams(def, {});
    expect(p.diameterMm).toBe(3);
    expect(p.clearanceMm).toBeUndefined();
  });

  it("preset overwrites dims; editing dim sets custom", () => {
    const def = getMacroDef("screen")!;
    const base = defaultParamsForDef(def);
    expect(base.preset).toBe("custom");

    const afterPreset = applyMacroParamUpdate(
      def,
      base,
      { preset: "2.8-ili9341" },
      SCREEN_PRESETS
    );
    expect(afterPreset.preset).toBe("2.8-ili9341");
    expect(afterPreset.widthMm).toBe(SCREEN_PRESETS["2.8-ili9341"].widthMm);

    const afterDim = applyMacroParamUpdate(def, afterPreset, { widthMm: 60 }, SCREEN_PRESETS);
    expect(afterDim.preset).toBe("custom");
    expect(afterDim.widthMm).toBe(60);
  });
});

describe("macros expand catalog", () => {
  it("lists v1 defs without separate circle/button", () => {
    const ids = listMacroDefs().map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["panel", "screen", "mount-hole"]));
    expect(ids).not.toContain("button");
    expect(getMacroDef("button")?.id).toBe("mount-hole"); // legacy alias
  });

  it("screen expands to 4 holes + 1 rect", () => {
    const def = getMacroDef("screen")!;
    const paths = def.expand(defaultParamsForDef(def));
    expect(paths).toHaveLength(5);
  });

  it("mount-hole diameter is exact cut size", () => {
    const def = getMacroDef("mount-hole")!;
    const params = validateParams(def, { diameterMm: 3 });
    const paths = def.expand(params);
    const bbox = computeBounds(paths);
    expect(bbox.maxX - bbox.minX).toBeCloseTo(3, 1);
  });

  it("expandMacro applies transform", () => {
    const def = getMacroDef("mount-hole")!;
    const obj: MacroObj = {
      kind: "macro",
      id: "m1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      defId: "mount-hole",
      defVersion: def.defVersion,
      params: defaultParamsForDef(def)
    };
    const ok = expandMacro(obj);
    expect(ok.ok).toBe(true);
  });
});

describe("macros place cascade", () => {
  it("does not stack macros at same transform", () => {
    const doc: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "layer-1", name: "L", visible: true, locked: false }],
      objects: []
    };
    const t0 = nextCascadeTransform(doc);
    doc.objects.push({
      kind: "macro",
      id: "a",
      layerId: "layer-1",
      transform: t0,
      defId: "mount-hole",
      defVersion: 1,
      params: {}
    });
    const t1 = nextCascadeTransform(doc);
    expect(t1.e).not.toBe(t0.e);
  });
});

describe("macros planCam integration", () => {
  it("includes expanded macro paths", () => {
    const def = getMacroDef("mount-hole")!;
    const document: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "layer-1", name: "Cut", visible: true, locked: false, operationId: "op-1" }],
      objects: [
        {
          kind: "macro",
          id: "h1",
          layerId: "layer-1",
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          defId: "mount-hole",
          defVersion: def.defVersion,
          params: defaultParamsForDef(def)
        }
      ]
    };
    const cam = {
      operations: [{ id: "op-1", name: "Cut", mode: "line" as const, speed: 1000, power: 80, passes: 1 }]
    };
    const result = planCam(document, cam);
    expect(result.plan.ops[0].paths.length).toBeGreaterThanOrEqual(1);
  });

  it("three-part sample: panel + screen + hole", () => {
    const mk = (id: string, defId: string, e: number, f: number): MacroObj => {
      const def = getMacroDef(defId)!;
      return {
        kind: "macro",
        id,
        layerId: "layer-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e, f },
        defId,
        defVersion: def.defVersion,
        params: defaultParamsForDef(def)
      };
    };
    const document: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "layer-1", name: "Cut", visible: true, locked: false, operationId: "op-1" }],
      objects: [
        mk("panel", "panel", 0, 0),
        mk("screen", "screen", 20, 20),
        mk("hole", "mount-hole", 100, 50)
      ]
    };
    const cam = {
      operations: [{ id: "op-1", name: "Cut", mode: "line" as const, speed: 1000, power: 80, passes: 1 }],
      optimizePaths: false
    };
    const result = planCam(document, cam);
    // panel 5 + screen 5 + hole 1 = 11
    expect(result.plan.ops[0].paths.length).toBe(11);
  });
});
