import { describe, expect, it } from "vitest";
import { prepareCutSheet } from "./cutSheet";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "./workspace";
import { renderEnclosureWorkspace } from "./render";
import { packParts } from "../layout/pack";
import { INITIAL_STATE } from "../state/types";
import { generateGcode } from "../gcode";
import { generateFitCoupon } from "./coupon";

const machine = INITIAL_STATE.machineProfile;
const dialect = { newline: "\n", useG0ForTravel: true, powerCommand: "S", enableLaser: "M4", disableLaser: "M5" };
const cam = { operations: [{ id: "cut", name: "Cut", mode: "line" as const, speed: 900, power: 50, passes: 1 }] };
function fixture(coupon = false) {
  const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 160, height: 100, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: coupon ? { selectedClearance: .15 } : {} };
  const result = regenerateEnclosureWorkspace(base);
  if (!result.ok) throw new Error("Fixture generation failed");
  const parts = result.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height }));
  if (coupon) { const fit = generateFitCoupon({ thickness: 3, clearance: .15 }); parts.push({ id: fit.id, ...fit.bounds }); }
  const workspace = { ...result.workspace, sheetLayout: packParts(parts, { sheetSize: { width: 210, height: 148 }, margin: 5, gap: 3 }) };
  return renderEnclosureWorkspace({ version: 1, units: "mm", objects: [], layers: [{ id: "layer-components-box", name: "Box", visible: true, locked: false, operationId: "cut" }] }, workspace);
}
describe("physical sheet cutting", () => {
  it("exports each face exactly once within one physical sheet, including coupon geometry", () => {
    const document = fixture(true), layout = document.enclosureWorkspace!.sheetLayout!;
    expect(layout.sheets.length).toBeGreaterThan(1);
    const exported: string[] = [];
    for (const sheet of layout.sheets) {
      const cut = prepareCutSheet(document, machine, sheet.id);
      expect(cut.objects.length).toBeGreaterThan(0);
      expect(cut.objects.every(object => !object.construction)).toBe(true);
      exported.push(...cut.objects.map(object => object.id));
      const result = generateGcode(cut, cam, machine, dialect);
      expect(result.stats.segments).toBeGreaterThan(0);
      for (const match of result.gcode.matchAll(/X(-?[\d.]+) Y(-?[\d.]+)/g)) {
        expect(Number(match[1])).toBeGreaterThanOrEqual(0);
        expect(Number(match[1])).toBeLessThanOrEqual(sheet.width);
        expect(Number(match[2])).toBeGreaterThanOrEqual(0);
        expect(Number(match[2])).toBeLessThanOrEqual(sheet.height);
      }
    }
    expect(exported.sort()).toEqual(document.objects.filter(object => !object.construction).map(object => object.id).sort());
    expect(new Set(exported).size).toBe(exported.length);
  });
  it("rejects unselected multi-sheet exports, missing operations, and stale faces", () => {
    const document = fixture();
    expect(() => generateGcode(document, cam, machine, dialect)).toThrow("Select one physical sheet");
    const cut = prepareCutSheet(document, machine, document.enclosureWorkspace!.sheetLayout!.sheets[0].id);
    expect(() => generateGcode(cut, { operations: [] }, machine, dialect)).toThrow("Assign a cutting operation");
    document.enclosureWorkspace!.enclosure.parameters.frontHeight += 1;
    expect(() => prepareCutSheet(document, machine, "sheet-1")).toThrow();
  });
});
