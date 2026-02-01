import { describe, it, expect } from "vitest";
import { Document, CamSettings } from "../model";
import { AppState } from "../state/types";
import { createHistory, pushState, undo, redo, canUndo, canRedo } from "./history";

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
