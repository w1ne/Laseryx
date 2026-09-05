import { describe, it, expect } from "vitest";
import { Document, CamSettings } from "../model";
import { AppState } from "../state/types";
import { createHistory, pushState, undo, redo, canUndo, canRedo } from "./history";
import { appReducer } from "./reducer";
import { INITIAL_STATE } from "./types";
import type { EnclosureWorkspace } from "../enclosure/workspace";

describe("history", () => {
    const s1 = { document: { version: 1, units: "mm", layers: [], objects: [] } as unknown as Document, camSettings: { operations: [] } as unknown as CamSettings, selectedObjectId: null } as AppState;
    const s2 = { ...s1, selectedObjectId: "obj1" };
    const s3 = { ...s1, selectedObjectId: "obj2" };

    it("should manage simple undo/redo flow", () => {
        let h = createHistory(s1);
        expect(canUndo(h)).toBe(false);
        expect(canRedo(h)).toBe(false);

        h = pushState(h, s2);
        expect(h.present).toEqual(s2);
        expect(h.past).toEqual([s1]);
        expect(canUndo(h)).toBe(true);

        h = undo(h);
        expect(h.present).toEqual(s1);
        expect(h.future).toEqual([s2]);

        h = redo(h);
        expect(h.present).toEqual(s2);
        expect(h.past).toEqual([s1]);
    });

    it("should clear future on push", () => {
        let h = createHistory(s1);
        h = pushState(h, s2);
        h = undo(h);
        expect(canRedo(h)).toBe(true);

        h = pushState(h, s3);
        expect(canRedo(h)).toBe(false);
        expect(h.past.length).toBe(1);
    });

    it("should respect MAX_HISTORY", () => {
        let h = createHistory(s1);
        for (let i = 0; i < 60; i++) {
            h = pushState(h, { ...s1, selectedObjectId: `id-${i}` });
        }
        expect(h.past.length).toBe(50);
    });

    it("should not push identical state", () => {
        let h = createHistory(s1);
        h = pushState(h, s1);
        expect(h.past.length).toBe(0);
    });
});

describe("enclosure workspace history", () => {
    const workspace = (revision: number): EnclosureWorkspace => ({
        version: 1,
        presets: [],
        sourcePanel: { id: "panel", name: "Source panel", width: 80, height: 50, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } },
        enclosure: { id: "box", revision, parameters: { frontHeight: 20, rearHeight: 30, thickness: 3, clearance: .15, fingerTarget: 8 } },
        coupon: { confirmed: false }
    });

    it("updates generated geometry and workspace as one undoable command without losing unrelated objects", () => {
        const unrelated = { kind: "path", id: "user-shape", layerId: "layer-1", closed: true, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } as const;
        const initial = { ...INITIAL_STATE, document: { ...INITIAL_STATE.document, objects: [unrelated] }, history: createHistory({ document: { ...INITIAL_STATE.document, objects: [unrelated] }, camSettings: INITIAL_STATE.camSettings, selectedObjectId: null }) };
        const changed = appReducer(initial, { type: "SET_ENCLOSURE_WORKSPACE", payload: workspace(0) });

        expect(changed.document.enclosureWorkspace).toEqual(workspace(0));
        expect(changed.document.objects).toContainEqual(unrelated);
        expect(changed.history.past).toHaveLength(1);

        const undone = appReducer(changed, { type: "UNDO" });
        expect(undone.document.enclosureWorkspace).toBeUndefined();
        expect(undone.document.objects).toEqual([unrelated]);
        const redone = appReducer(undone, { type: "REDO" });
        expect(redone.document.enclosureWorkspace).toEqual(workspace(0));
    });

    it("does not retain aliases to a dispatched workspace payload", () => {
        const payload = workspace(0);
        const changed = appReducer(INITIAL_STATE, { type: "SET_ENCLOSURE_WORKSPACE", payload });
        payload.sourcePanel.width = 999;
        payload.sourcePanel.transform.e = 42;
        expect(changed.document.enclosureWorkspace?.sourcePanel.width).toBe(80);
        expect(changed.document.enclosureWorkspace?.sourcePanel.transform.e).toBe(0);
        expect(changed.history.present.document.enclosureWorkspace?.sourcePanel.width).toBe(80);
    });
});
