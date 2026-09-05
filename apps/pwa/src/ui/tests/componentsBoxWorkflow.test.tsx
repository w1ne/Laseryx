import { describe, expect, it } from "vitest";
import { appReducer } from "../../core/state/reducer";
import { INITIAL_STATE } from "../../core/state/types";
import { createHistory } from "../../core/state/history";
import { addComponentInstance, createInstanceFromPreset, regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { packParts } from "../../core/layout/pack";

describe("Components & Box store workflow", () => {
  it("keeps source cutouts and makes arranging one reversible command", () => {
    const preset = { id: "switch", name: "Power switch", kind: "circle" as const, dimensions: { diameter: 8 } };
    const workspace: EnclosureWorkspace = {
      version: 1, presets: [preset],
      sourcePanel: addComponentInstance({ id: "source", name: "Control panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, createInstanceFromPreset(preset, "switch-1", { a: 1, b: 0, c: 0, d: 1, e: 50, f: 35 })),
      enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false }
    };
    const made = regenerateEnclosureWorkspace(workspace);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const initial = { ...INITIAL_STATE, history: createHistory({ document: INITIAL_STATE.document, camSettings: INITIAL_STATE.camSettings, selectedObjectId: null }) };
    const boxed = appReducer(initial, { type: "SET_ENCLOSURE_WORKSPACE", payload: made.workspace });
    expect(boxed.document.groups?.filter(({ id }) => id.includes(":face:")).length).toBe(6);
    expect(boxed.document.objects.some(({ name }) => name === "Power switch")).toBe(true);
    const layout = packParts(made.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 } });
    const arranged = appReducer(boxed, { type: "SET_ENCLOSURE_WORKSPACE", payload: { ...made.workspace, sheetLayout: layout } });
    expect(arranged.document.objects.some(({ layerId }) => layerId === "layer-components-box-sheets")).toBe(true);
    const undone = appReducer(arranged, { type: "UNDO" });
    expect(undone.document.enclosureWorkspace?.sheetLayout).toBeUndefined();
    expect(appReducer(undone, { type: "REDO" }).document.enclosureWorkspace?.sheetLayout).toEqual(layout);
  });
});
