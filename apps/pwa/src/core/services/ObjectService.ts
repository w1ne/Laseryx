import { AppState } from "../state/types";
import { Action } from "../state/actions";
import { ShapeObj } from "../model";

export const ObjectService = {
    addRectangle: (state: AppState, dispatch: React.Dispatch<Action>) => {
        const uniqueId = `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Ensure a layer exists using the shared helper
        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "line", "Layer");

        const newObj: ShapeObj = {
            id: uniqueId,
            kind: "shape",
            shape: { type: "rect", width: 80, height: 50 },
            transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 },
            layerId: layerId
        };

        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
    },

    updateObjectLayer: (dispatch: React.Dispatch<Action>, objectId: string, layerId: string) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes: { layerId } }
        });
    },

    updateObject: (dispatch: React.Dispatch<Action>, objectId: string, changes: any) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes }
        });
    },

    deleteObject: (dispatch: React.Dispatch<Action>, objectId: string) => {
        if (confirm("Delete this object?")) {
            dispatch({ type: "DELETE_OBJECT", payload: objectId });
        }
    },

    // Import Helpers
    addObjects: (dispatch: React.Dispatch<Action>, state: AppState, objects: any[]) => {
        // Find a "Line" layer (default for vectors)
        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "line", "Vector Layer");

        objects.forEach(obj => {
            dispatch({ type: "ADD_OBJECT", payload: { ...obj, layerId } });
        });

        if (objects.length > 0) {
            dispatch({ type: "SELECT_OBJECT", payload: objects[0].id });
        }
    },

    addImage: (dispatch: React.Dispatch<Action>, state: AppState, src: string, width: number, height: number) => {
        // Find a "Fill" layer (default for images)
        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "fill", "Image Layer");

        const uniqueId = `img-${Date.now()}`;
        const newObj = {
            kind: "image",
            id: uniqueId,
            layerId: layerId,
            transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 },
            width,
            height,
            src
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj as any });
        dispatch({ type: "SELECT_OBJECT", payload: uniqueId });
    },

    // Helper to find existing layer with mode or create new one
    findOrCreateLayer: (state: AppState, dispatch: React.Dispatch<Action>, mode: "line" | "fill", namePrefix: string): string => {
        // Check existing layers
        for (const layer of state.document.layers) {
            const op = state.camSettings.operations.find(o => o.id === layer.operationId);
            if (op && op.mode === mode) {
                return layer.id;
            }
        }

        // None found, create one (Reusing logic from LayerService implicitly via dispatch not ideal, 
        // but we need to generate IDs here to return them immediately.
        // Actually, better to copy the exact logic from LayerService or expose a Helper there.
        // For simplicity, just creating it here inline)

        const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLayerId = `layer-${uniqueSuffix}`;
        const newOpId = `op-${uniqueSuffix}`;

        const newLayer = {
            id: newLayerId,
            name: `${namePrefix} ${state.document.layers.length + 1}`,
            visible: true,
            locked: false,
            operationId: newOpId
        };

        const newOp = {
            id: newOpId,
            name: mode === "line" ? "Cut" : "Raster",
            mode: mode,
            speed: 1000,
            power: 50,
            passes: 1,
            order: "insideOut" as const
        };

        dispatch({ type: "ADD_LAYER", payload: newLayer });

        // We have to update operations manually as we don't have atomic Add Layer with Op action yet
        dispatch({ type: "ADD_OPERATION", payload: newOp });

        return newLayerId;
    }
};
