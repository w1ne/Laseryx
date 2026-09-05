import { describe, expect, it } from "vitest";
import { preflightEnclosure } from "./preflight";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "./workspace";
import { packParts } from "../layout/pack";
import { renderEnclosureWorkspace } from "./render";
import { generateFitCoupon } from "./coupon";

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

  it("allows non-blocking warnings and does not require coupon confirmation", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: false } };
    const generated = regenerateEnclosureWorkspace(base);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 }, margin: 5, gap: 2 });
    const arranged = { ...generated.workspace, sheetLayout: layout };
    expect(preflightEnclosure({ workspace: arranged, warnings: ["Review grain direction before cutting."] }).ready).toBe(true);
    const coupon = generateFitCoupon({ thickness: 3, clearance: .1 });
    const withCoupon = { ...arranged, coupon: { selectedClearance: .1, confirmed: false }, sheetLayout: packParts([...generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { id: coupon.id, ...coupon.bounds }], { sheetSize: { width: 500, height: 500 }, margin: 5, gap: 2 }) };
    expect(preflightEnclosure({ workspace: withCoupon }).ready).toBe(true);
  });

  it("rejects forged layout parts and layouts that omit generated faces", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(base);
    if (!generated.ok) throw new Error("fixture failed");
    const forged = { sheetSize: { width: 500, height: 500 }, orientation: "landscape" as const, margin: 5, gap: 2, parts: [{ id: "fake", width: 1, height: 1 }], sheets: [{ id: "sheet-1", x: 0, y: 0, width: 500, height: 500 }], placements: [{ partId: "fake", sheetId: "sheet-1", x: 5, y: 5, rotation: 0 as const }], unplacedPartIds: [] };
    const result = preflightEnclosure({ workspace: { ...generated.workspace, sheetLayout: forged } });
    expect(result.ready).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain("LAYOUT_PART_MISMATCH");
  });

  it("checks stock dimensions, bed dimensions, and thickness numerically without comparing profile ids", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(base);
    if (!generated.ok) throw new Error("fixture failed");
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 } });
    const workspace = { ...generated.workspace, sheetLayout: layout };
    expect(preflightEnclosure({ workspace, stockProfile: { id: "birch", thickness: 3.0005, width: 500, height: 500 }, machineProfile: { id: "laser", bedMm: { w: 500, h: 500 } } }).ready).toBe(true);
    const blocked = preflightEnclosure({ workspace, stockThickness: 4, stockWidth: 400, stockHeight: 400, machineProfile: { bedMm: { w: 450, h: 450 } } });
    expect(blocked.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["STOCK_PROFILE_MISMATCH", "STOCK_SIZE_EXCEEDED", "MACHINE_BED_EXCEEDED"]));
  });

  it("blocks a stored result made from older source dimensions until regeneration", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(base);
    if (!generated.ok) throw new Error("fixture failed");
    const stale = { ...generated.workspace, sourcePanel: { ...generated.workspace.sourcePanel, width: 110 } };
    const result = preflightEnclosure({ workspace: stale });
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "STALE_GENERATED_RESULT", message: expect.stringMatching(/regenerate box/i) }));
  });

  it("blocks missing component measurements and insufficient body depth", () => {
    const preset = { id: "module", name: "Button module", kind: "rectangle" as const, dimensions: { width: 20, height: 10 }, mechanics: { confidence: "required" as const, body: { width: 30, height: 15, depth: 100 }, missing: ["mounting-hole positions"] } };
    const component = { ...preset, id: "module-1", presetId: preset.id, transform: { a: 1, b: 0, c: 0, d: 1, e: 50, f: 35 } };
    const base: EnclosureWorkspace = { version: 1, presets: [preset], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [component], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    const generated = regenerateEnclosureWorkspace(base); if (!generated.ok) throw new Error("fixture failed");
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 } });
    const result = preflightEnclosure({ workspace: { ...generated.workspace, sheetLayout: layout } });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MEASURE_REQUIRED", objectIds: ["module-1"] }),
      expect.objectContaining({ code: "BODY_CLEARANCE", objectIds: ["module-1"] })
    ]));
    expect(result.ready).toBe(false);
  });

  it("checks every sheet against bed size without using canvas offsets", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(base); if (!generated.ok) throw new Error("fixture failed");
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 200, height: 150 } });
    const offsetLayout = { ...layout, sheets: layout.sheets.map((sheet, index) => ({ ...sheet, x: index * 250, y: 300 })) };
    const workspace = { ...generated.workspace, sheetLayout: offsetLayout };
    expect(preflightEnclosure({ workspace, machineProfile: { bedMm: { w: 200, h: 150 } } }).issues.map(({ code }) => code)).not.toContain("MACHINE_BED_EXCEEDED");
    expect(preflightEnclosure({ workspace, machineProfile: { bedMm: { w: 190, h: 140 } } }).issues.map(({ code }) => code)).toContain("MACHINE_BED_EXCEEDED");
  });

  it("blocks when actual rendered cut geometry was tampered with", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(base); if (!generated.ok) throw new Error("fixture failed");
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 } });
    const workspace = { ...generated.workspace, sheetLayout: layout }, document = renderEnclosureWorkspace({ version: 1, units: "mm", layers: [], objects: [] }, workspace);
    document.objects[0].transform.e += 1;
    const result = preflightEnclosure({ workspace, document });
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "RENDERED_GEOMETRY_STALE", message: expect.stringMatching(/rendered geometry is out of date/i) }));
  });
});
