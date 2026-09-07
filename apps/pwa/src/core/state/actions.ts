import { Document, CamSettings, Layer, Obj, Operation, MachineProfile, MaterialPreset } from "../model";
import { MachineStatus, MachineConnectionState, MachineStreamState } from "./types";
import type { EnclosureWorkspace } from "../enclosure/workspace";
import type { ComponentInstance } from "../components/types";
import type { Transform } from "../model";

export type Action =
    // Document Actions
    | { type: "SET_DOCUMENT"; payload: Document; skipHistory?: boolean }
    /** Atomically replace enclosure workspace and its derived document geometry. */
    | { type: "SET_ENCLOSURE_WORKSPACE"; payload: EnclosureWorkspace }
    | { type: "UPDATE_ENCLOSURE_PLACEMENT"; payload: { partId: string; x: number; y: number; rotation: 0 | 90 }; skipHistory?: boolean }
    | { type: "UPDATE_PANEL_TRANSFORM"; payload: Transform; skipHistory?: boolean }
    | { type: "UPDATE_COMPONENT_INSTANCE"; payload: { id: string; changes: Partial<Omit<ComponentInstance, "id" | "kind">> }; skipHistory?: boolean }
    | { type: "ADD_LAYER"; payload: Layer }
    | { type: "DELETE_LAYER"; payload: string } // layerId
    | { type: "ADD_OBJECT"; payload: Obj }
    | { type: "UPDATE_OBJECT"; payload: { id: string; changes: Partial<Obj> }; skipHistory?: boolean }
    /** Push current document snapshot onto undo stack (e.g. end of canvas drag). */
    | { type: "COMMIT_HISTORY" }
    | { type: "DELETE_OBJECT"; payload: string } // objectId
    | { type: "SELECT_OBJECT"; payload: string | null }
    /** Shift+click multi-select toggle. */
    | { type: "TOGGLE_OBJECT_SELECTION"; payload: string }
    | { type: "SET_SELECTION"; payload: string[] }
    /** Select a sketch dimension/constraint (or null to clear). */
    | { type: "SELECT_CONSTRAINT"; payload: string | null }
    /** Full sketch replace (caller already solved+baked or SET_DOCUMENT preferred). */
    | { type: "SET_SKETCH"; payload: NonNullable<Document["sketch"]> }

    // CAM Actions
    | { type: "SET_CAM_SETTINGS"; payload: CamSettings }
    // We can add granular CAM actions later (UPDATE_OPERATION etc)
    | { type: "ADD_OPERATION"; payload: Operation }

    // Machine Actions
    | { type: "SET_MACHINE_STATUS"; payload: MachineStatus }
    | { type: "SET_CONNECTION_STATUS"; payload: MachineConnectionState }
    | { type: "SET_STREAM_STATUS"; payload: MachineStreamState }

    // Machine Profile Actions
    | { type: "SET_MACHINE_PROFILES"; payload: MachineProfile[] }
    | { type: "ADD_MACHINE_PROFILE"; payload: MachineProfile }
    | { type: "UPDATE_MACHINE_PROFILE"; payload: { id: string; changes: Partial<MachineProfile> } }
    | { type: "DELETE_MACHINE_PROFILE"; payload: string }
    | { type: "SELECT_MACHINE_PROFILE"; payload: string } // id

    // Material Actions
    | { type: "SET_MATERIAL_PRESETS"; payload: MaterialPreset[] }
    | { type: "ADD_MATERIAL_PRESET"; payload: MaterialPreset }
    | { type: "DELETE_MATERIAL_PRESET"; payload: string } // id

    // UI Actions
    | { type: "SET_ACTIVE_TAB"; payload: "design" | "machine" }

    // History Actions
    | { type: "UNDO" }
    | { type: "REDO" };
