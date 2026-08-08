import { Document, CamSettings, Layer, Obj, Operation, MachineProfile, MaterialPreset } from "../model";
import { MachineStatus, MachineConnectionState, MachineStreamState } from "./types";

export type Action =
    // Document Actions
    | { type: "SET_DOCUMENT"; payload: Document }
    | { type: "ADD_LAYER"; payload: Layer }
    | { type: "DELETE_LAYER"; payload: string } // layerId
    | { type: "ADD_OBJECT"; payload: Obj }
    | { type: "UPDATE_OBJECT"; payload: { id: string; changes: Partial<Obj> }; skipHistory?: boolean }
    /** Push current document snapshot onto undo stack (e.g. end of canvas drag). */
    | { type: "COMMIT_HISTORY" }
    | { type: "DELETE_OBJECT"; payload: string } // objectId
    | { type: "SELECT_OBJECT"; payload: string | null }

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
