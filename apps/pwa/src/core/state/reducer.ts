import { AppState } from "./types";
import { Obj } from "../model";
import { Action } from "./actions";
import { pushState, undo, redo, UndoableState } from "./history";

/**
 * List of action types that should trigger a history snapshot.
 */
const UNDOABLE_ACTIONS = new Set([
    "SET_DOCUMENT",
    "ADD_LAYER",
    "DELETE_LAYER",
    "ADD_OBJECT",
    "UPDATE_OBJECT",
    "DELETE_OBJECT",
    "SELECT_OBJECT",
    "SET_CAM_SETTINGS",
    "ADD_OPERATION"
]);

export function appReducer(state: AppState, action: Action): AppState {
    // 1. Handle History Actions explicitly
    if (action.type === "UNDO") {
        const h = undo(state.history);
        return {
            ...state,
            ...h.present,
            history: h
        };
    }

    if (action.type === "REDO") {
        const h = redo(state.history);
        return {
            ...state,
            ...h.present,
            history: h
        };
    }

    // 2. Perform the internal reduction
    const newState = internalReducer(state, action);

    // 3. If action was undoable, update history
    if (UNDOABLE_ACTIONS.has(action.type)) {
        const nextUndoable: UndoableState = {
            document: newState.document,
            camSettings: newState.camSettings,
            selectedObjectId: newState.selectedObjectId
        };
        return {
            ...newState,
            history: pushState(state.history, nextUndoable)
        };
    }

    return newState;
}

function internalReducer(state: AppState, action: Action): AppState {
    console.log("Action:", action.type, action);
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
                            ? ({ ...obj, ...action.payload.changes } as Obj)
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

        case "ADD_OPERATION":
            return {
                ...state,
                camSettings: {
                    ...state.camSettings,
                    operations: [...state.camSettings.operations, action.payload]
                }
            };

        case "SET_MACHINE_STATUS":
            return { ...state, machineStatus: action.payload };

        case "SET_CONNECTION_STATUS":
            return { ...state, machineConnection: action.payload };

        case "SET_STREAM_STATUS":
            return { ...state, machineStream: action.payload };

        case "SET_MACHINE_PROFILES":
            return { ...state, machineProfiles: action.payload };

        case "ADD_MACHINE_PROFILE":
            return { ...state, machineProfiles: [...state.machineProfiles, action.payload] };

        case "UPDATE_MACHINE_PROFILE": {
            const updatedProfiles = state.machineProfiles.map(p =>
                p.id === action.payload.id ? { ...p, ...action.payload.changes } : p
            );
            const active = updatedProfiles.find(p => p.id === state.activeMachineProfileId) || state.machineProfile;
            return {
                ...state,
                machineProfiles: updatedProfiles,
                machineProfile: active
            };
        }

        case "DELETE_MACHINE_PROFILE": {
            const remains = state.machineProfiles.filter(p => p.id !== action.payload);
            return { ...state, machineProfiles: remains };
        }

        case "SELECT_MACHINE_PROFILE": {
            const found = state.machineProfiles.find(p => p.id === action.payload);
            if (!found) return state;
            return {
                ...state,
                activeMachineProfileId: found.id,
                machineProfile: found
            };
        }

        case "SET_MATERIAL_PRESETS":
            return { ...state, materialPresets: action.payload };

        case "ADD_MATERIAL_PRESET":
            return { ...state, materialPresets: [...state.materialPresets, action.payload] };

        case "DELETE_MATERIAL_PRESET":
            return { ...state, materialPresets: state.materialPresets.filter(p => p.id !== action.payload) };

        case "SET_ACTIVE_TAB":
            return { ...state, ui: { ...state.ui, activeTab: action.payload } };

        default:
            return state;
    }
}
