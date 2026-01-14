import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Document } from '../core/model';

export interface ProjectRec {
    id: string;
    name: string;
    updatedAt: number;
    document: Document; // Note: ImageObj inside will contain asset IDs, not blob URLs (runtime only)
    thumbnail?: Blob;
}

export interface AssetRec {
    id: string;
    data: Blob;
    mimeType: string;
}

export interface LaserDB extends DBSchema {
    projects: {
        key: string;
        value: ProjectRec;
        indexes: { 'by-date': number };
    };
    assets: {
        key: string;
        value: AssetRec;
    };
}

let dbPromise: Promise<IDBPDatabase<LaserDB>>;

export function getDb() {
    if (!dbPromise) {
        dbPromise = openDB<LaserDB>('laserfather-db', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('projects')) {
                    const store = db.createObjectStore('projects', { keyPath: 'id' });
                    store.createIndex('by-date', 'updatedAt');
                }
                if (!db.objectStoreNames.contains('assets')) {
                    db.createObjectStore('assets', { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}
