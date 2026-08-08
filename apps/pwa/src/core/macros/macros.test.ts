import { describe, it, expect } from "vitest";
import {
  applyMacroParamUpdate,
  circleToPolyline,
  cutDiameter,
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

  it("cutDiameter adds clearance", () => {
    expect(cutDiameter(3, 0.2)).toBeCloseTo(3.2);
  });
});

describe("macros validateParams + preset rules", () => {
  it("fills defaults for mount-hole", () => {
    const def = getMacroDef("mount-hole")!;
    const p = validateParams(def, {});
    expect(p.diameterMm).toBe(3);
    expect(p.clearanceMm).toBe(0.2);
  });

  it("preset overwrites dims; editing dim sets custom", () => {
    const def = getMacroDef("screen")!;
    const base = defaultParamsForDef(def);
    expect(base.preset).toBe("2.8-ili9341");
    expect(base.widthMm).toBe(SCREEN_PRESETS["2.8-ili9341"].widthMm);

    const afterDim = applyMacroParamUpdate(def, base, { widthMm: 60 }, SCREEN_PRESETS);
    expect(afterDim.preset).toBe("custom");
    expect(afterDim.widthMm).toBe(60);

    const afterPreset = applyMacroParamUpdate(
      def,
      afterDim,
      { preset: "2.8-ili9341" },
      SCREEN_PRESETS
    );
    expect(afterPreset.preset).toBe("2.8-ili9341");
    expect(afterPreset.widthMm).toBe(SCREEN_PRESETS["2.8-ili9341"].widthMm);
  });
});

describe("macros expand catalog", () => {
  it("lists v1 defs", () => {
    const ids = listMacroDefs().map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(v1DefIds()));
    expect(ids).toContain("panel");
    expect(ids).toContain("screen");
    expect(ids).toContain("mount-hole");
    expect(ids).toContain("button");
  });

  it("screen expands to 4 holes + 1 rect", () => {
    const def = getMacroDef("screen")!;
    const paths = def.expand(defaultParamsForDef(def));
    expect(paths).toHaveLength(5);
    expect(paths.every((p) => p.closed)).toBe(true);
  });

  it("mount-hole radius includes clearance", () => {
    const def = getMacroDef("mount-hole")!;
    const params = validateParams(def, { diameterMm: 3, clearanceMm: 0.2 });
    const paths = def.expand(params);
    const bbox = computeBounds(paths);
    const size = bbox.maxX - bbox.minX;
    expect(size).toBeCloseTo(3.2, 1);
  });

  it("expandMacro applies transform and reports unknown def", () => {
    const def = getMacroDef("button")!;
    const obj: MacroObj = {
      kind: "macro",
      id: "m1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      defId: "button",
      defVersion: def.defVersion,
      params: defaultParamsForDef(def)
    };
    const ok = expandMacro(obj);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const bbox = computeBounds(ok.paths);
      expect(bbox.minX).toBeGreaterThan(0);
      expect(bbox.minY).toBeGreaterThan(0);
    }

    const bad = expandMacro({ ...obj, defId: "nope" });
    expect(bad.ok).toBe(false);
    expect(bad.paths).toEqual([]);
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
  it("includes expanded macro paths and warns on unknown def", () => {
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
        },
        {
          kind: "macro",
          id: "bad",
          layerId: "layer-1",
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          defId: "missing-def",
          defVersion: 1,
          params: {}
        }
      ]
    };
    const cam = {
      operations: [{ id: "op-1", name: "Cut", mode: "line" as const, speed: 1000, power: 80, passes: 1 }]
    };
    const result = planCam(document, cam);
    expect(result.plan.ops[0].paths.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes("missing-def") || w.includes("Unknown macro"))).toBe(
      true
    );
  });

  it("four-part sample produces multiple closed paths (golden shape snapshot)", () => {
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
        mk("hole", "mount-hole", 100, 50),
        mk("btn", "button", 120, 50)
      ]
    };
    const cam = {
      operations: [{ id: "op-1", name: "Cut", mode: "line" as const, speed: 1000, power: 80, passes: 1 }],
      optimizePaths: false
    };
    const result = planCam(document, cam);
    const paths = result.plan.ops[0].paths;
    // panel: 4 holes + outer = 5; screen: 5; mount: 1; button: 1 => 12
    expect(paths.length).toBe(12);
    expect(paths.every((p) => p.closed && p.points.length >= 3)).toBe(true);
    const bbox = computeBounds(paths);
    expect(bbox.maxX - bbox.minX).toBeGreaterThan(50);
    expect(bbox.maxY - bbox.minY).toBeGreaterThan(50);
  });
});
