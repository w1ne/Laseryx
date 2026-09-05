import { describe, expect, it } from "vitest";
import type { ComponentPreset } from "../components/types";
import type { PanelDesign } from "../panel/types";
import { addComponentInstance, createComponentInstanceFromPreset, regenerateEnclosureWorkspace, removeComponentInstance, sanitizeEnclosureWorkspace, updateComponentInstance, type EnclosureWorkspace } from "./workspace";

const transform = { a: 1, b: 0, c: 0, d: 1, e: 12, f: 14 };
const preset: ComponentPreset = { id: "display", name: "Display", kind: "rectangle", dimensions: { width: 20, height: 10 } };
const panel = (components = [] as PanelDesign["components"]): PanelDesign => ({ id: "panel", name: "Panel", width: 100, height: 80, transform: { ...transform, e: 0, f: 0 }, components });
const parameters = { frontHeight: 30, rearHeight: 35, thickness: 3, clearance: 0.15, fingerTarget: 8 };

describe("enclosure workspace", () => {
  it("creates an instance as a deep snapshot of preset dimensions and transform", () => {
    const instance = createComponentInstanceFromPreset(preset, "instance", transform);
    (preset.dimensions as { width: number }).width = 99;
    transform.e = 99;
    expect(instance).toMatchObject({ id: "instance", presetId: "display", dimensions: { width: 20, height: 10 }, transform: { e: 12 } });
  });

  it("adds, updates, and removes source-panel instances without mutating prior values", () => {
    const instance = createComponentInstanceFromPreset(preset, "instance");
    const original = panel();
    const added = addComponentInstance(original, instance);
    const updated = updateComponentInstance(added, "instance", { name: "Screen", transform: { ...transform, e: 12 } });
    const removed = removeComponentInstance(updated, "instance");
    expect(original.components).toEqual([]);
    expect(added.components[0].name).toBe("Display");
    expect(updated.components[0]).toMatchObject({ name: "Screen", transform: { e: 12, f: 14 } });
    expect(removed.components).toEqual([]);
  });

  it("regenerates six stable faces, increments revision, and preserves only fitting unchanged placements", () => {
    const first: EnclosureWorkspace = { version: 1, presets: [preset], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false }, sheetLayout: undefined };
    const generated = regenerateEnclosureWorkspace(first);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.workspace.enclosure.result?.panels.map(({ id }) => id)).toEqual(["source-panel", "rear", "left", "right", "base", "service-panel"]);
    const parts = generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height }));
    const placed = { ...generated.workspace, sheetLayout: { sheetSize: { width: 210, height: 148 }, orientation: "landscape" as const, margin: 5, gap: 2, parts, sheets: [{ id: "s", x: 0, y: 0, width: 210, height: 148 }], placements: [{ partId: "source-panel", sheetId: "s", x: 8, y: 8, rotation: 0 as const }], unplacedPartIds: parts.slice(1).map(({ id }) => id) } };
    const again = regenerateEnclosureWorkspace(placed);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.workspace.enclosure).toMatchObject({ id: "box", revision: 2 });
      expect(again.workspace.sheetLayout?.placements).toEqual([{ partId: "source-panel", sheetId: "s", x: 8, y: 8, rotation: 0 }]);
      expect(again.workspace.sheetLayout?.unplacedPartIds).toContain("rear");
    }
  });

  it("rejects invalid source panels without changing the workspace", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { ...panel(), width: 0 }, enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false } };
    const result = regenerateEnclosureWorkspace(workspace);
    expect(result).toMatchObject({ ok: false, issues: [{ code: "invalid-dimension" }] });
    expect(workspace.enclosure.revision).toBe(0);
  });

  it("rejects malformed persisted generated results", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 1, parameters, result: "corrupt" as unknown as EnclosureWorkspace["enclosure"]["result"] }, coupon: { confirmed: false } };
    expect(sanitizeEnclosureWorkspace(workspace)).toBeUndefined();
  });

  it("rejects unsafe nested layouts and generated geometry before regeneration", () => {
    const generated = regenerateEnclosureWorkspace({ version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false } });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const parts = generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height }));
    const valid: EnclosureWorkspace = { ...generated.workspace, sheetLayout: { sheetSize: { width: 210, height: 148 }, orientation: "landscape", margin: 5, gap: 2, parts, sheets: [{ id: "sheet", x: 0, y: 0, width: 210, height: 148 }], placements: [{ partId: "source-panel", sheetId: "sheet", x: 5, y: 5, rotation: 0 }], unplacedPartIds: parts.slice(1).map(({ id }) => id) } };
    expect(() => regenerateEnclosureWorkspace(sanitizeEnclosureWorkspace(valid)!)).not.toThrow();

    const corruptions: Array<(value: EnclosureWorkspace) => void> = [
      (value) => { (value.sheetLayout!.placements as unknown[]) = [null]; },
      (value) => { (value.sheetLayout!.placements[0] as { rotation: number }).rotation = 45; },
      (value) => { (value.sheetLayout!.placements[0] as { x: number }).x = Number.NaN; },
      (value) => { (value.sheetLayout!.parts[0] as { id?: string }).id = undefined; },
      (value) => { value.enclosure.result!.panels[0].paths[0].points[0].x = Number.NaN; },
      (value) => { value.enclosure.result!.panels[0].transform.a = Number.NaN; },
      (value) => { value.enclosure.result!.joints[0].mateId = ""; }
    ];
    for (const corrupt of corruptions) {
      const value = structuredClone(valid);
      corrupt(value);
      expect(sanitizeEnclosureWorkspace(value)).toBeUndefined();
    }
  });

  it("rejects semantically invalid components, layouts, and excessive collections", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [{ id: "slot", name: "Slot", kind: "slot", dimensions: { length: 10, width: 4 } }], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false } };
    const invalidPresets: unknown[] = [
      { id: "", name: "Hole", kind: "circle", dimensions: { diameter: 8 } },
      { id: "bad", name: "Hole", kind: "circle", dimensions: { diameter: 0 } },
      { id: "bad", name: "Slot", kind: "slot", dimensions: { length: 3, width: 4 } },
      { id: "bad", name: "Round", kind: "rounded-rectangle", dimensions: { width: 10, height: 8, cornerRadius: 5 } },
      { id: "bad", name: "Buttons", kind: "button-row", dimensions: { count: 2.5, diameter: 4, pitch: 8 } }
    ];
    for (const invalid of invalidPresets) expect(sanitizeEnclosureWorkspace({ ...base, presets: [invalid] })).toBeUndefined();
    expect(sanitizeEnclosureWorkspace({ ...base, presets: [base.presets[0], structuredClone(base.presets[0])] })).toBeUndefined();
    const orphan = createComponentInstanceFromPreset(base.presets[0], "placed");
    expect(sanitizeEnclosureWorkspace({ ...base, sourcePanel: panel([orphan]), presets: [] })).toBeUndefined();
    expect(sanitizeEnclosureWorkspace({ ...base, sourcePanel: { ...panel(), width: -1 } })).toBeUndefined();
    expect(sanitizeEnclosureWorkspace({ ...base, presets: Array.from({ length: 1001 }, (_, index) => ({ ...base.presets[0], id: `p-${index}` })) })).toBeUndefined();
  });

  it("accepts valid mechanics and rejects unsafe mechanical values", () => {
    const mechanical = { ...preset, mechanics: { confidence: "measured" as const, body: { width: 20, height: 10, depth: 8 }, mountingHoles: [{ x: 2, y: 0, diameter: 3 }] } };
    const base: EnclosureWorkspace = { version: 1, presets: [mechanical], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: {} };
    expect(sanitizeEnclosureWorkspace(base)).toBeDefined();
    expect(sanitizeEnclosureWorkspace({ ...base, presets: [{ ...mechanical, mechanics: { ...mechanical.mechanics, body: { ...mechanical.mechanics.body, depth: -1 } } }] })).toBeUndefined();
  });

  it("accepts but strips legacy coupon confirmation", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: true, selectedClearance: .15 } };
    expect(sanitizeEnclosureWorkspace(base)?.coupon).toEqual({ selectedClearance: .15 });
  });

  it("requires every layout part exactly once and rejects out-of-bounds or overlapping placements", () => {
    const layout = { sheetSize: { width: 100, height: 100 }, orientation: "landscape" as const, margin: 5, gap: 2, parts: [{ id: "a", width: 20, height: 10 }, { id: "b", width: 20, height: 10 }], sheets: [{ id: "sheet", x: 0, y: 0, width: 100, height: 100 }], placements: [{ partId: "a", sheetId: "sheet", x: 5, y: 5, rotation: 0 as const }], unplacedPartIds: ["b"] };
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false }, sheetLayout: layout };
    expect(sanitizeEnclosureWorkspace(base)).toBeDefined();
    expect(sanitizeEnclosureWorkspace({ ...base, sheetLayout: { ...layout, unplacedPartIds: [] } })).toBeUndefined();
    expect(sanitizeEnclosureWorkspace({ ...base, sheetLayout: { ...layout, placements: [{ ...layout.placements[0], x: 81 }] } })).toBeUndefined();
    expect(sanitizeEnclosureWorkspace({ ...base, sheetLayout: { ...layout, placements: [layout.placements[0], { partId: "b", sheetId: "sheet", x: 24, y: 5, rotation: 0 }], unplacedPartIds: [] } })).toBeUndefined();
  });

  it("rejects non-reciprocal or inconsistent generated joints", () => {
    const generated = regenerateEnclosureWorkspace({ version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false } });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const brokenMate = structuredClone(generated.workspace);
    brokenMate.enclosure.result!.joints[0].mateId = brokenMate.enclosure.result!.joints[0].id;
    expect(sanitizeEnclosureWorkspace(brokenMate)).toBeUndefined();
    const inconsistentPanel = structuredClone(generated.workspace);
    inconsistentPanel.enclosure.result!.panels[0].joints = [];
    expect(sanitizeEnclosureWorkspace(inconsistentPanel)).toBeUndefined();
  });

  it("matches generator parameter sign rules exactly", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters: { ...parameters, clearance: 0 } }, coupon: { confirmed: false } };
    expect(sanitizeEnclosureWorkspace(base)).toBeDefined();
    for (const field of ["frontHeight", "rearHeight", "thickness", "fingerTarget"] as const) {
      for (const invalid of [0, -1]) expect(sanitizeEnclosureWorkspace({ ...base, enclosure: { ...base.enclosure, parameters: { ...base.enclosure.parameters, [field]: invalid } } })).toBeUndefined();
    }
    expect(sanitizeEnclosureWorkspace({ ...base, enclosure: { ...base.enclosure, parameters: { ...base.enclosure.parameters, clearance: -0.01 } } })).toBeUndefined();

    const generated = regenerateEnclosureWorkspace(base);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    for (const field of ["width", "depth", "frontHeight", "rearHeight", "thickness", "fingerTarget"] as const) {
      for (const invalid of [0, -1]) {
        const value = structuredClone(generated.workspace);
        value.enclosure.result!.input[field] = invalid;
        expect(sanitizeEnclosureWorkspace(value)).toBeUndefined();
      }
    }
    const badClearance = structuredClone(generated.workspace);
    badClearance.enclosure.result!.input.clearance = -0.01;
    expect(sanitizeEnclosureWorkspace(badClearance)).toBeUndefined();
  });

  it("accepts hundreds of sparse placements through bounded validation", () => {
    const parts = Array.from({ length: 500 }, (_, index) => ({ id: `part-${index}`, width: 1, height: 1 }));
    const layout = { sheetSize: { width: 2000, height: 20 }, orientation: "landscape" as const, margin: 0, gap: 1, parts, sheets: [{ id: "sheet", x: 0, y: 0, width: 2000, height: 20 }], placements: parts.map((part, index) => ({ partId: part.id, sheetId: "sheet", x: index * 3, y: 0, rotation: 0 as const })), unplacedPartIds: [] };
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false }, sheetLayout: layout };
    expect(sanitizeEnclosureWorkspace(workspace)?.sheetLayout?.placements).toHaveLength(500);
  });

  it("sanitizes persisted packing preferences", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: panel(), enclosure: { id: "box", revision: 0, parameters }, coupon: { confirmed: false }, packing: { sheetSize: { width: 300, height: 200 }, orientation: "portrait", margin: 7, gap: 4 } };
    expect(sanitizeEnclosureWorkspace(base)?.packing).toEqual(base.packing);
    expect(sanitizeEnclosureWorkspace({ ...base, packing: { ...base.packing!, margin: -1 } })).toBeUndefined();
  });
});
