import { AppState } from "../state/types";
import { Action } from "../state/actions";
import { Layer, Operation } from "../model";

export const LayerService = {
    addLayer: (state: AppState, dispatch: React.Dispatch<Action>) => {
        // Unique ID logic extracted from App.tsx
        const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLayerId = `layer-${uniqueSuffix}`;
        const newOpId = `op-${uniqueSuffix}`;

        const newLayer: Layer = {
            id: newLayerId,
            name: `Layer ${state.document.layers.length + 1}`,
            visible: true,
            locked: false,
            operationId: newOpId
        };

        // We also need to add the operation to camSettings
        //Ideally this should be atomic, but for now we dispatch two actions or update the reducer to handle both.
        // Let's modify the reducer/actions to be more atomic or dispatch multiple.
        // For now, let's just use the primitives.

        dispatch({ type: "ADD_LAYER", payload: newLayer });

        // We need to add the operation too. Since we don't have ADD_OPERATION yet, 
        // let's assume we update the whole camSettings or add a specific action.
        // I'll add a helper action for this in the future, but for now lets strictly follow the Refactoring plan 
        // and rely on what we have. 
        // Actually, `SET_CAM_SETTINGS` is what we have. 

        const newOp: Operation = {
            id: newOpId,
            type: "vectorCut",
            speedMmMin: 1000,
            powerPct: 50,
            passes: 1,
            order: "insideOut"
        };

        const newSettings = {
            ...state.camSettings,
            operations: [...state.camSettings.operations, newOp]
        };

        dispatch({ type: "SET_CAM_SETTINGS", payload: newSettings });
    },

    deleteLayer: (state: AppState, dispatch: React.Dispatch<Action>, layerId: string) => {
        // Validation Logic
        const hasObjects = state.document.objects.some(obj => obj.layerId === layerId);
        if (hasObjects) {
            alert("Cannot delete this layer because it contains objects. Please reassign or delete the objects first.");
            return;
        }

        if (state.document.layers.length <= 1) {
            alert("Cannot delete the last layer.");
            return;
        }

        dispatch({ type: "DELETE_LAYER", payload: layerId });
        // Ideally we also clean up operations, but it's optional garbage collection.
    }
};
