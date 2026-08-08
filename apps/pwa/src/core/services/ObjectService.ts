import { AppState } from "../state/types";
import { Action } from "../state/actions";
import { ShapeObj, Obj, ImageObj, MacroObj } from "../model";
import {
    defaultParamsForDef,
    getMacroDef,
    nextCascadeTransform,
    revalidateMacroParams
} from "../macros";

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

    addMacro: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        defId: string,
        partialParams?: Record<string, unknown>
    ): MacroObj | null => {
        const def = getMacroDef(defId);
        if (!def) {
            console.error(`Unknown macro defId: ${defId}`);
            return null;
        }

        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "line", "Layer");
        const params = revalidateMacroParams(defId, defaultParamsForDef(def), partialParams ?? {}) ??
            defaultParamsForDef(def);
        const transform = nextCascadeTransform(state.document, state.machineProfile?.bedMm);

        const newObj: MacroObj = {
            kind: "macro",
            id: `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            transform,
            defId: def.id,
            defVersion: def.defVersion,
            params
        };

        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    updateMacroParams: (
        dispatch: React.Dispatch<Action>,
        object: MacroObj,
        partial: Record<string, unknown>
    ) => {
        const next = revalidateMacroParams(object.defId, object.params, partial);
        if (!next) return;
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: object.id, changes: { params: next } }
        });
    },

    updateObjectLayer: (dispatch: React.Dispatch<Action>, objectId: string, layerId: string) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes: { layerId } }
        });
    },

    updateObject: (
        dispatch: React.Dispatch<Action>,
        objectId: string,
        changes: Partial<Obj>,
        options?: { skipHistory?: boolean }
    ) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes },
            skipHistory: options?.skipHistory
        });
    },

    /** Call after a canvas drag so Undo reverts the whole move/resize once. */
    commitHistory: (dispatch: React.Dispatch<Action>) => {
        dispatch({ type: "COMMIT_HISTORY" });
    },

    deleteObject: (dispatch: React.Dispatch<Action>, objectId: string) => {
        if (confirm("Delete this object?")) {
            dispatch({ type: "DELETE_OBJECT", payload: objectId });
        }
    },

    // Import Helpers
    addObjects: (dispatch: React.Dispatch<Action>, state: AppState, objects: Obj[]) => {
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
        const newObj: ImageObj = {
            kind: "image",
            id: uniqueId,
            layerId: layerId,
            transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 },
            width,
            height,
            src
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
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
