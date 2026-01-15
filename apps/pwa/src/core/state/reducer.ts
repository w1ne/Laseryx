import { AppState } from "./types";
import { Action } from "./actions";

export function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "SET_DOCUMENT":
            return { ...state, document: action.payload };

        case "ADD_LAYER":
            return {
                ...state,
                document: {
                    ...state.document,
                    layers: [...state.document.layers, action.payload]
                }
            };

        case "DELETE_LAYER":
            // Note: Validation logic (don't delete if objects exist) should happen in Service/Action creator
            return {
                ...state,
                document: {
                    ...state.document,
                    layers: state.document.layers.filter(l => l.id !== action.payload)
                }
            };

        case "ADD_OBJECT":
            return {
                ...state,
                document: {
                    ...state.document,
                    objects: [...state.document.objects, action.payload]
                }
            };

        case "UPDATE_OBJECT":
            return {
                ...state,
                document: {
                    ...state.document,
                    objects: state.document.objects.map(obj =>
                        obj.id === action.payload.id
                            ? { ...obj, ...action.payload.changes } as any // Simplified casting, proper merging handled by spread
                            : obj
                    )
                }
            };

        case "DELETE_OBJECT":
            return {
                ...state,
                document: {
                    ...state.document,
                    objects: state.document.objects.filter(o => o.id !== action.payload)
                },
                selectedObjectId: state.selectedObjectId === action.payload ? null : state.selectedObjectId
            };

        case "SELECT_OBJECT":
            return { ...state, selectedObjectId: action.payload };

        case "SET_CAM_SETTINGS":
            return { ...state, camSettings: action.payload };

        case "SET_MACHINE_STATUS":
            return { ...state, machineStatus: action.payload };

        case "SET_CONNECTION_STATUS":
            return { ...state, machineConnection: action.payload };

        case "SET_ACTIVE_TAB":
            return { ...state, ui: { ...state.ui, activeTab: action.payload } };

        default:
            return state;
    }
}
