import { Document, CamSettings, Layer, Obj } from "../model";
import { MachineStatus, MachineConnectionState } from "./types";

export type Action =
    // Document Actions
    | { type: "SET_DOCUMENT"; payload: Document }
    | { type: "ADD_LAYER"; payload: Layer }
    | { type: "DELETE_LAYER"; payload: string } // layerId
    | { type: "ADD_OBJECT"; payload: Obj }
    | { type: "UPDATE_OBJECT"; payload: { id: string; changes: Partial<Obj> } }
    | { type: "DELETE_OBJECT"; payload: string } // objectId
    | { type: "SELECT_OBJECT"; payload: string | null }

    // CAM Actions
    | { type: "SET_CAM_SETTINGS"; payload: CamSettings }
    // We can add granular CAM actions later (UPDATE_OPERATION etc)

    // Machine Actions
    | { type: "SET_MACHINE_STATUS"; payload: MachineStatus }
    | { type: "SET_CONNECTION_STATUS"; payload: MachineConnectionState }

    // UI Actions
    | { type: "SET_ACTIVE_TAB"; payload: "design" | "machine" };
