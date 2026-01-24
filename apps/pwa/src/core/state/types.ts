import { Document, CamSettings, MachineProfile } from "../model";

export const INITIAL_MACHINE_PROFILE: MachineProfile = {
    id: "default-machine",
    name: "Default Machine",
    bedMm: { w: 400, h: 400 },
    origin: "frontLeft",
    sRange: { min: 0, max: 1000 },
    laserMode: "M3",
    baudRate: 115200
};

export type MachineStatus = {
    state: "IDLE" | "RUN" | "HOLD" | "ALARM" | "DOOR" | "CHECK" | "HOME" | "SLEEP" | "UNKNOWN";
    mpos: { x: number; y: number; z: number };
    wpos: { x: number; y: number; z: number };
    feed?: number;
    spindle?: number;
};

export type MachineConnectionState =
    | { status: "disconnected" }
    | { status: "connecting" }
    | { status: "connected" }
    | { status: "error"; message: string };

export type MachineStreamState = {
    state: "idle" | "streaming" | "paused" | "error" | "done";
    message?: string;
    progress?: number;
};

export type AppState = {
    document: Document;
    camSettings: CamSettings;
    machineProfile: MachineProfile; // The currently active profile
    machineProfiles: MachineProfile[]; // List of all loaded profiles
    activeMachineProfileId: string; // ID of the active one (redundant but helpful for selection UI)
    machineStatus: MachineStatus;
    machineConnection: MachineConnectionState;
    machineStream: MachineStreamState;
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
        layers: [
            { id: "layer-1", name: "Layer 1", visible: true, locked: false, operationId: "op-1" }
        ],
        objects: []
    },
    camSettings: {
        operations: [
            { id: "op-1", name: "Cut", mode: "line", speed: 1000, power: 80, passes: 1 }
        ]
    },
    machineProfile: INITIAL_MACHINE_PROFILE,
    machineProfiles: [INITIAL_MACHINE_PROFILE],
    activeMachineProfileId: INITIAL_MACHINE_PROFILE.id,
    machineStatus: {
        state: "UNKNOWN",
        mpos: { x: 0, y: 0, z: 0 },
        wpos: { x: 0, y: 0, z: 0 },
        feed: 0,
        spindle: 0
    },
    machineConnection: { status: "disconnected" },
    machineStream: { state: "idle" },
    selectedObjectId: null,
    ui: {
        activeTab: "design",
        previewMode: "2d"
    }
};
