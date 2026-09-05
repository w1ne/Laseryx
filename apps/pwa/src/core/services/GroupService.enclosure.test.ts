import { describe, expect, it } from "vitest";
import { GroupService } from "./GroupService";
import { appReducer } from "../state/reducer";
import { INITIAL_STATE, type AppState } from "../state/types";
import type { Action } from "../state/actions";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../enclosure/workspace";
import { packParts } from "../layout/pack";

describe("GroupService enclosure movement", () => {
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
});
