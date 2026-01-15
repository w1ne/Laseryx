import { Document, CamSettings, MachineProfile } from "../model";

export type MachineStatus = {
    state: "Idle" | "Run" | "Hold" | "Alarm" | "Door" | "Check" | "Home" | "Sleep" | "UNKNOWN";
    mpos: { x: number; y: number; z: number };
    wpos: { x: number; y: number; z: number };
    feed: number;
    spindle: number;
};

export type MachineConnectionState =
    | { status: "disconnected" }
    | { status: "connecting" }
    | { status: "connected" }
    | { status: "error"; message: string };

export type AppState = {
    document: Document;
    camSettings: CamSettings;
    machineProfile: MachineProfile;
    machineStatus: MachineStatus;
    machineConnection: MachineConnectionState;
    selectedObjectId: string | null;
    ui: {
        activeTab: "design" | "machine";
        previewMode: "2d" | "3d"; // Future proofing
    };
};

export const INITIAL_STATE: AppState = {
    document: {
        version: 1,
        units: "mm",
        layers: [],
        objects: []
    },
    camSettings: {
        operations: []
    },
    machineProfile: {
        bedMm: { w: 400, h: 400 },
        origin: "frontLeft",
        sRange: { min: 0, max: 1000 },
        laserMode: "M3"
    },
    machineStatus: {
        state: "UNKNOWN",
        mpos: { x: 0, y: 0, z: 0 },
        wpos: { x: 0, y: 0, z: 0 },
        feed: 0,
        spindle: 0
    },
    machineConnection: { status: "disconnected" },
    selectedObjectId: null,
    ui: {
        activeTab: "design",
        previewMode: "2d"
    }
};
