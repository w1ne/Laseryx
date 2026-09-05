import { AppState } from "./types";
import { Obj } from "../model";
import { Action } from "./actions";
import { pushState, undo, redo, UndoableState } from "./history";
import { renderEnclosureWorkspace } from "../enclosure/render";

/**
 * List of action types that should trigger a history snapshot.
 */
const UNDOABLE_ACTIONS = new Set([
    "SET_DOCUMENT",
    "SET_ENCLOSURE_WORKSPACE",
    "UPDATE_ENCLOSURE_PLACEMENT",
    "ADD_LAYER",
    "DELETE_LAYER",
    "ADD_OBJECT",
    "UPDATE_OBJECT",
    "DELETE_OBJECT",
    "SELECT_OBJECT",
    "SET_SKETCH",
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

    if (action.type === "COMMIT_HISTORY") {
        const nextUndoable: UndoableState = {
            document: state.document,
            camSettings: state.camSettings,
            selectedObjectId: state.selectedObjectId
        };
        return {
            ...state,
            history: pushState(state.history, nextUndoable)
        };
    }

    // 2. Perform the internal reduction
    const newState = internalReducer(state, action);

    // 3. If action was undoable, update history (canvas drag uses skipHistory + COMMIT_HISTORY)
    if (
        UNDOABLE_ACTIONS.has(action.type) &&
        !(action.type === "UPDATE_OBJECT" && action.skipHistory) &&
        !(action.type === "UPDATE_ENCLOSURE_PLACEMENT" && action.skipHistory) &&
        !(action.type === "SET_DOCUMENT" && action.skipHistory)
    ) {
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

        case "SET_ENCLOSURE_WORKSPACE": {
            const workspace = structuredClone(action.payload);
            return { ...state, document: renderEnclosureWorkspace(state.document, workspace) };
        }

        case "UPDATE_ENCLOSURE_PLACEMENT": {
            const workspace = state.document.enclosureWorkspace;
            if (!workspace?.sheetLayout || ![action.payload.x, action.payload.y].every(Number.isFinite)) return state;
            if (!workspace.sheetLayout.placements.some(({ partId }) => partId === action.payload.partId)) return state;
            const next = structuredClone(workspace);
            next.sheetLayout = { ...next.sheetLayout!, placements: next.sheetLayout!.placements.map((placement) => placement.partId === action.payload.partId ? { ...placement, ...action.payload } : placement) };
            return { ...state, document: renderEnclosureWorkspace(state.document, next) };
        }

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

        case "DELETE_OBJECT": {
            const selectedObjectIds = state.selectedObjectIds.filter((id) => id !== action.payload);
            return {
                ...state,
                document: {
                    ...state.document,
                    objects: state.document.objects.filter(o => o.id !== action.payload)
                },
                selectedObjectId:
                    state.selectedObjectId === action.payload
                        ? selectedObjectIds[selectedObjectIds.length - 1] ?? null
                        : state.selectedObjectId,
                selectedObjectIds
            };
        }

        case "SELECT_OBJECT":
            return {
                ...state,
                selectedObjectId: action.payload,
                selectedObjectIds: action.payload ? [action.payload] : [],
                selectedConstraintId: null
            };

        case "TOGGLE_OBJECT_SELECTION": {
            const id = action.payload;
            const has = state.selectedObjectIds.includes(id);
            const selectedObjectIds = has
                ? state.selectedObjectIds.filter((x) => x !== id)
                : [...state.selectedObjectIds, id];
            const selectedObjectId =
                selectedObjectIds.length === 0
                    ? null
                    : has
                      ? selectedObjectIds[selectedObjectIds.length - 1] ?? null
                      : id;
            return { ...state, selectedObjectId, selectedObjectIds, selectedConstraintId: null };
        }

        case "SET_SELECTION": {
            const selectedObjectIds = action.payload;
            const selectedObjectId =
                selectedObjectIds.length > 0
                    ? selectedObjectIds[selectedObjectIds.length - 1]
                    : null;
            return { ...state, selectedObjectId, selectedObjectIds, selectedConstraintId: null };
        }

        case "SELECT_CONSTRAINT":
            return {
                ...state,
                selectedConstraintId: action.payload,
                // Clear object selection so Delete removes the dim, not a shape
                selectedObjectId: action.payload ? null : state.selectedObjectId,
                selectedObjectIds: action.payload ? [] : state.selectedObjectIds
            };

        case "SET_SKETCH":
            return {
                ...state,
                document: {
                    ...state.document,
                    sketch: action.payload
                }
            };

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
