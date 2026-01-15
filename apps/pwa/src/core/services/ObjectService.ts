import { AppState } from "../state/types";
import { Action } from "../state/actions";
import { ShapeObj } from "../model";

export const ObjectService = {
    addRectangle: (state: AppState, dispatch: React.Dispatch<Action>) => {
        const uniqueId = `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Robust default layer logic
        const layerId = state.document.layers.length > 0 ? state.document.layers[0].id : "layer-1";

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

    // Import Helpers
    addObjects: (dispatch: React.Dispatch<Action>, objects: any[]) => {
        objects.forEach(obj => {
            dispatch({ type: "ADD_OBJECT", payload: obj });
        });
        // Select the first one if available
        if (objects.length > 0) {
            dispatch({ type: "SELECT_OBJECT", payload: objects[0].id });
        }
    },

    addImage: (dispatch: React.Dispatch<Action>, src: string, width: number, height: number) => {
        const uniqueId = `img-${Date.now()}`;
        const newObj = {
            kind: "image",
            id: uniqueId,
            layerId: "layer-1", // Should ideally be same default logic as addRectangle
            transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 },
            width,
            height,
            src
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj as any });
        dispatch({ type: "SELECT_OBJECT", payload: uniqueId });
    }
};
