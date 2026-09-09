import { describe, expect, it } from "vitest";
import { GroupService } from "./GroupService";
import { appReducer } from "../state/reducer";
import { INITIAL_STATE } from "../state/types";
import type { Action } from "../state/actions";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../enclosure/workspace";
import { packParts } from "../layout/pack";

describe("GroupService enclosure movement", () => {
  it("selects a source component cutout independently from the panel group", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [{ id: "knob-1", presetId: "knob", name: "Knob", kind: "circle", dimensions: { diameter: 10 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 } }], transform: { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    const cutoutId = "components-box:panel:source:cutout:knob-1:0";
    const dispatch = (action: Action) => { state = appReducer(state, action); };
    expect(GroupService.selectWithGroup(state, dispatch, cutoutId)).toEqual([cutoutId]);
    expect(state.selectedObjectId).toBe(cutoutId);
    expect(state.selectedObjectIds).toEqual([cutoutId]);
  });

  it("moves the pre-box source panel group through its authoritative transform", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    const group = state.document.groups!.find(({ id }) => id === "components-box:panel:source")!;
    const dispatch = (action: Action) => { state = appReducer(state, action); };
    GroupService.translateSelection(state, dispatch, group.memberIds, 10, 5);
    expect(state.document.enclosureWorkspace!.sourcePanel.transform).toMatchObject({ e: 12, f: 8 });
    expect(state.document.objects.filter(({ id }) => group.memberIds.includes(id)).every(({ transform }) => transform.e === 12 && transform.f === 8)).toBe(true);
  });

  it("synchronizes a generated face group into its sheet-local placement", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: true } };
    const generated = regenerateEnclosureWorkspace(workspace); if (!generated.ok) throw new Error("fixture failed");
    const layout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 } });
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: { ...generated.workspace, sheetLayout: layout } });
    const group = state.document.groups!.find(({ id }) => id.endsWith(":face:source-panel"))!;
    const before = state.document.enclosureWorkspace!.sheetLayout!.placements.find(({ partId }) => partId === "source-panel")!;
    const dispatch = (action: Action) => { state = appReducer(state, action); };
    GroupService.translateSelection(state, dispatch, group.memberIds, 12, 7);
    const after = state.document.enclosureWorkspace!.sheetLayout!.placements.find(({ partId }) => partId === "source-panel")!;
    expect(after).toMatchObject({ x: before.x + 12, y: before.y + 7 });
    const sheet = layout.sheets.find(({ id }) => id === after.sheetId)!;
    expect(state.document.objects.filter(({ id }) => group.memberIds.includes(id)).every(({ transform }) => transform.e === sheet.x + after.x && transform.f === sheet.y + after.y)).toBe(true);
    expect(GroupService.updateEnclosurePlacement(state, dispatch, group.memberIds, { rotation: 90 })).toBe(true);
    expect(state.document.enclosureWorkspace!.sheetLayout!.placements.find(({ partId }) => partId === "source-panel")!.rotation).toBe(90);
    expect(state.document.objects.filter(({ id }) => group.memberIds.includes(id)).every(({ transform }) => transform.a === 0 && transform.b === 1)).toBe(true);
  });

  it("deletes a complete source component when one mounting-hole path is selected and supports undo", () => {
    const unrelated = { kind: "shape" as const, id: "unrelated", layerId: "layer-1", transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, shape: { type: "rect" as const, width: 5, height: 5 } };
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [{ id: "slider-1", presetId: "slider", name: "Slider", kind: "slot", dimensions: { length: 30, width: 2 }, mechanics: { confidence: "measured", mountingHoles: [{ x: -20, y: 0, diameter: 3 }, { x: 20, y: 0, diameter: 3 }] }, transform: { a: 1, b: 0, c: 0, d: 1, e: 50, f: 35 } }], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    let state = { ...INITIAL_STATE, document: { ...INITIAL_STATE.document, objects: [unrelated] } };
    state = appReducer(state, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    const mountingHoleId = "components-box:panel:source:cutout:slider-1:2";
    state = appReducer(state, { type: "SELECT_OBJECT", payload: mountingHoleId });
    const dispatch = (action: Action) => { state = appReducer(state, action); };

    expect(GroupService.deleteSelection(state, dispatch)).toBe(true);
    expect(state.document.enclosureWorkspace?.sourcePanel.components).toEqual([]);
    expect(state.document.objects.some(({ id }) => id === "unrelated")).toBe(true);
    expect(state.document.objects.some(({ id }) => id.includes("slider-1"))).toBe(false);
    expect(state.selectedObjectId).toBeNull();

    state = appReducer(state, { type: "UNDO" });
    expect(state.document.enclosureWorkspace?.sourcePanel.components.map(({ id }) => id)).toEqual(["slider-1"]);
    expect(state.document.objects.filter(({ id }) => id.includes("slider-1"))).toHaveLength(3);
  });

  it("deduplicates multi-path selections and deletes multiple source components", () => {
    const component = (id: string, x: number) => ({ id, presetId: id, name: id, kind: "circle" as const, dimensions: { diameter: 8 }, transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: 35 } });
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [component("a", 25), component("b", 75)], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    state = appReducer(state, { type: "SET_SELECTION", payload: ["components-box:panel:source:cutout:a:0", "components-box:panel:source:cutout:a:0", "components-box:panel:source:cutout:b:0"] });
    const dispatch = (action: Action) => { state = appReducer(state, action); };

    expect(GroupService.deleteSelection(state, dispatch)).toBe(true);
    expect(state.document.enclosureWorkspace?.sourcePanel.components).toEqual([]);
  });

  it("deletes a single-path component instead of expanding to the whole panel group", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [{ id: "button", presetId: "button", name: "Button", kind: "circle", dimensions: { diameter: 8 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 50, f: 35 } }], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    state = appReducer(state, { type: "SELECT_OBJECT", payload: "components-box:panel:source:cutout:button:0" });
    const dispatch = (action: Action) => { state = appReducer(state, action); };

    expect(GroupService.deleteSelection(state, dispatch)).toBe(true);
    expect(state.document.enclosureWorkspace?.sourcePanel.components).toEqual([]);
    expect(state.document.objects.some(({ id }) => id.endsWith(":outline"))).toBe(true);
  });

  it("rejects mixed selections and generated face paths without partial deletion", () => {
    const workspace: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Panel", width: 100, height: 70, components: [{ id: "a", presetId: "a", name: "A", kind: "circle", dimensions: { diameter: 8 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 25, f: 35 } }], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: {} };
    let state = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace });
    const before = state.document;
    state = appReducer(state, { type: "SET_SELECTION", payload: ["components-box:panel:source:cutout:a:0", "free-object"] });
    const dispatch = (action: Action) => { state = appReducer(state, action); };
    expect(GroupService.deleteSelection(state, dispatch)).toBe(false);
    expect(state.document).toBe(before);

    expect(GroupService.deleteObjects(state, dispatch, ["components-box:box:face:source-panel:1"])).toBe(false);
    expect(state.document).toBe(before);
  });
});
