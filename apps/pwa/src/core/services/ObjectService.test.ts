import { describe, it, expect, vi } from "vitest";
import { ObjectService } from "./ObjectService";
import { INITIAL_STATE } from "../state/types";
import { AppState } from "../state/types";

describe("ObjectService", () => {
    it("addRectangle should look for existing line layer", () => {
        const dispatch = vi.fn();
        const state: AppState = JSON.parse(JSON.stringify(INITIAL_STATE));

        // INITIAL_STATE now has a default layer (as of our fix), so it should use it.
        // Let's ensure our test setup has that layer.
        expect(state.document.layers.length).toBeGreaterThan(0);
        const defaultLayerId = state.document.layers[0].id;

        ObjectService.addRectangle(state, dispatch);

        // Verify ADD_OBJECT was dispatched
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: "ADD_OBJECT",
            payload: expect.objectContaining({
                kind: "shape",
                layerId: defaultLayerId // Should reuse existing
            })
        }));
    });

    it("addRectangle should create a layer if none exists (Simulating the bug)", () => {
        const dispatch = vi.fn();
        const state: AppState = JSON.parse(JSON.stringify(INITIAL_STATE));

        // CLEAR LAYERS TO SIMULATE BUG CONDITION
        state.document.layers = [];
        state.camSettings.operations = [];

        ObjectService.addRectangle(state, dispatch);

        // Should trigger ADD_LAYER, ADD_OPERATION, then ADD_OBJECT
        // Implementation Details: findOrCreateLayer dispatches ADD_LAYER and ADD_OPERATION

        // We expect dispatch to be called multiple times
        const calls = dispatch.mock.calls;
        const types = calls.map(c => c[0].type);

        expect(types).toContain("ADD_LAYER");
        expect(types).toContain("ADD_OPERATION");
        expect(types).toContain("ADD_OBJECT");

        // Verify the object was assigned the NEW layer id
        const addLayerCall = calls.find(c => c[0].type === "ADD_LAYER");
        const addObjectCall = calls.find(c => c[0].type === "ADD_OBJECT");

        const newLayerId = addLayerCall![0].payload.id;
        const assignedLayerId = addObjectCall![0].payload.layerId;

        expect(assignedLayerId).toBe(newLayerId);
    });

    it("addImage should create a Fill layer if only Line layer exists", () => {
        const dispatch = vi.fn();
        const state: AppState = JSON.parse(JSON.stringify(INITIAL_STATE));

        // Mock state has 1 layer (Line/Cut)
        // addImage needs "fill" layer

        ObjectService.addImage(dispatch, state, "blob:test", 100, 100);

        const calls = dispatch.mock.calls;
        const types = calls.map(c => c[0].type);

        // Should create NEW layer for Fill
        expect(types).toContain("ADD_LAYER");
        expect(types).toContain("ADD_OPERATION"); // Validates it creates a Raster Op

        const addOpCall = calls.find(c => c[0].type === "ADD_OPERATION");
        expect(addOpCall![0].payload.mode).toBe("fill");
    });
});
