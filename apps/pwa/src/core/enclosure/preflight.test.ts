import { describe, expect, it } from "vitest";
import { preflightEnclosure } from "./preflight";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "./workspace";
import { packParts } from "../layout/pack";

describe("preflightEnclosure", () => {
  it("blocks unknown measurements, overflow, and invalid stock", () => {
    const result = preflightEnclosure({ thickness: 0, couponConfirmed: false, unknownMeasurements: ["TACTS-12MOD-4CH"], overflowPartIds: ["front"], overlappingPartIds: [] });
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["INVALID_STOCK", "MEASURE_REQUIRED", "OUTSIDE_SHEET", "COUPON_UNCONFIRMED"]));
  });

  it("is ready after measurement, packing, and coupon confirmation", () => {
    expect(preflightEnclosure({ thickness: 3, couponConfirmed: true, unknownMeasurements: [], overflowPartIds: [], overlappingPartIds: [] })).toEqual({ ready: true, issues: [] });
  });

  it("runs component, joint, contour, and layout validation against a workspace", () => {
    const workspace: EnclosureWorkspace = {
      version: 1, presets: [],
      sourcePanel: { id: "source", name: "Operator panel", width: 80, height: 60, transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, components: [{ id: "bad", presetId: "bad", name: "Power switch", kind: "circle", dimensions: { diameter: -2 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 } }] },
      enclosure: { id: "box", revision: 0, parameters: { frontHeight: 20, rearHeight: 30, thickness: 3, clearance: .15, fingerTarget: 30 } },
      coupon: { confirmed: false, selectedClearance: .15 }
    };
    const result = preflightEnclosure({ workspace });
    expect(result.ready).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["COMPONENT_DIMENSIONS_INVALID", "WORKSPACE_INCOMPLETE", "COUPON_UNCONFIRMED"]));
    expect(result.issues.find(({ code }) => code === "COMPONENT_DIMENSIONS_INVALID")?.message).toMatch(/Power switch/);
  });

  it("allows non-blocking warnings but requires an included coupon to be confirmed", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: false } };
    const generated = regenerateEnclosureWorkspace(base);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 }, margin: 5, gap: 2 });
    const arranged = { ...generated.workspace, sheetLayout: layout };
    expect(preflightEnclosure({ workspace: arranged, warnings: ["Review grain direction before cutting."] }).ready).toBe(true);
    expect(preflightEnclosure({ workspace: { ...arranged, coupon: { selectedClearance: .1, confirmed: false } } }).ready).toBe(false);
  });
});
