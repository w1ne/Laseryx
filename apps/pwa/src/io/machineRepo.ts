import { openDB, DBSchema, IDBPDatabase } from "idb";
import { MachineProfile } from "../core/model";
import { INITIAL_MACHINE_PROFILE } from "../core/state/types";

interface MachineDB extends DBSchema {
    profiles: {
        key: string;
        value: MachineProfile;
    };
}

const DB_NAME = "laseryx-machines";
const DB_VERSION = 1;

class MachineRepository {
    private dbPromise: Promise<IDBPDatabase<MachineDB>>;

    constructor() {
        this.dbPromise = openDB<MachineDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("profiles")) {
                    db.createObjectStore("profiles", { keyPath: "id" });
                }
            },
        });
    }

    async save(profile: MachineProfile): Promise<void> {
        const db = await this.dbPromise;
        await db.put("profiles", profile);
    }

    async list(): Promise<MachineProfile[]> {
        const db = await this.dbPromise;
        return await db.getAll("profiles");
    }

    async delete(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete("profiles", id);
    }

    async initDefaults(): Promise<void> {
        const db = await this.dbPromise;
        const count = await db.count("profiles");
        if (count === 0) {
            // Seed with the default profile if empty
            // We need to ensure INITIAL_MACHINE_PROFILE has an ID and Name now.
            // We will handle that normalization in the app load or here.
            // For now, let's just save a "Default" one.
            const defaultProfile: MachineProfile = {
                ...INITIAL_MACHINE_PROFILE, // We'll assume this is updated or we create a fresh one here
                id: "default-machine",
                name: "Default Machine",
                baudRate: 115200 // Default GRBL
            };
            // Fix potential type mismatch if INITIAL_MACHINE_PROFILE is outdated in types.ts (I will update it next)
            // Actually, relying on types.ts being updated next step.
            await this.save(defaultProfile);
        }
    }
}

export const machineRepo = new MachineRepository();
