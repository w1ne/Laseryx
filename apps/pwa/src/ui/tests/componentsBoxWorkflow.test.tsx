import { describe, expect, it } from "vitest";
import { appReducer } from "../../core/state/reducer";
import { INITIAL_STATE } from "../../core/state/types";
import { createHistory } from "../../core/state/history";
import { addComponentInstance, createInstanceFromPreset, regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { packParts } from "../../core/layout/pack";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { preflightEnclosure } from "../../core/enclosure/preflight";
import { projectRepo } from "../../io/projectRepo";
import "fake-indexeddb/auto";

describe("Components & Box store workflow", () => {
  it("dispatches every workflow command atomically and round-trips the finished project", async () => {
    const preset = { id: "switch", name: "Power switch", kind: "circle" as const, dimensions: { diameter: 8 } };
    const panelWorkspace: EnclosureWorkspace = {
      version: 1, presets: [preset],
      sourcePanel: { id: "source", name: "Control panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } },
      enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false, selectedClearance: .15 }
    };
    const placedWorkspace = { ...panelWorkspace, sourcePanel: addComponentInstance(panelWorkspace.sourcePanel, createInstanceFromPreset(preset, "switch-1", { a: 1, b: 0, c: 0, d: 1, e: 50, f: 35 })) };
    const made = regenerateEnclosureWorkspace(placedWorkspace);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const initial = { ...INITIAL_STATE, history: createHistory({ document: INITIAL_STATE.document, camSettings: INITIAL_STATE.camSettings, selectedObjectId: null }) };
    const panelState = appReducer(initial, { type: "SET_ENCLOSURE_WORKSPACE", payload: panelWorkspace });
    const placedState = appReducer(panelState, { type: "SET_ENCLOSURE_WORKSPACE", payload: placedWorkspace });
    const boxed = appReducer(placedState, { type: "SET_ENCLOSURE_WORKSPACE", payload: made.workspace });
    expect([panelState, placedState, boxed].map(({ history }) => history.past.length)).toEqual([1, 2, 3]);
    expect(boxed.document.groups?.filter(({ id }) => id.includes(":face:")).length).toBe(6);
    expect(boxed.document.objects.some(({ name }) => name === "Power switch")).toBe(true);
    const coupon = generateFitCoupon({ thickness: 3, clearance: .15 });
    const layout = packParts([...made.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { id: coupon.id, ...coupon.bounds }], { sheetSize: { width: 500, height: 500 } });
    const manuallyPlaced = { ...layout, placements: layout.placements.map((placement, index) => index === layout.placements.length - 1 ? { ...placement, x: placement.x + 10 } : { ...placement }) };
    const finishedWorkspace = { ...made.workspace, sheetLayout: manuallyPlaced, coupon: { ...made.workspace.coupon, confirmed: true } };
    const arranged = appReducer(boxed, { type: "SET_ENCLOSURE_WORKSPACE", payload: finishedWorkspace });
    expect(arranged.history.past).toHaveLength(4);
    expect(arranged.document.objects.some(({ layerId }) => layerId === "layer-components-box-sheets")).toBe(true);
    const undone = appReducer(arranged, { type: "UNDO" });
    expect(undone.document.enclosureWorkspace?.sheetLayout).toBeUndefined();
    expect(appReducer(undone, { type: "REDO" }).document.enclosureWorkspace?.sheetLayout).toEqual(manuallyPlaced);
    expect(preflightEnclosure({ workspace: finishedWorkspace })).toEqual({ ready: true, issues: [] });
    const projectId = await projectRepo.save(arranged.document, new Map(), "Box workflow");
    const loaded = await projectRepo.load(projectId);
    expect(loaded?.document.enclosureWorkspace?.sheetLayout?.placements[0]).toEqual(manuallyPlaced.placements[0]);
    expect(loaded?.document.enclosureWorkspace?.sourcePanel.components[0].name).toBe("Power switch");
    expect(loaded?.document.enclosureWorkspace?.enclosure.result?.panels.find(({ id }) => id === "source-panel")?.paths).toHaveLength(2);
  });
});
