import { getDb, ProjectRec } from './db';
import { Document } from '../core/model';
import { randomId } from '../core/util';

export interface ProjectSummary {
    id: string;
    name: string;
    updatedAt: number;
}

export interface LoadedProject {
    document: Document;
    name: string;
    assets: Map<string, Blob>;
}

export const projectRepo = {
    /**
     * List all projects, newest first.
     */
    async list(): Promise<ProjectSummary[]> {
        const db = await getDb();
        const projects = await db.getAllFromIndex('projects', 'by-date');
        // Index sorts ascending, wrap to reverse
        return projects.reverse().map(p => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt
        }));
    },

    /**
     * Load a project and its referenced assets.
     * Returns null if not found.
     */
    async load(id: string): Promise<LoadedProject | null> {
        const db = await getDb();
        const proj = await db.get('projects', id);
        if (!proj) return null;

        const assets = new Map<string, Blob>();
        const imageIds = new Set<string>();

        // Scan document for images to identify required assets
        // We assume in stored document, ImageObj.src is the asset ID.
        for (const obj of proj.document.objects) {
            if (obj.kind === 'image') {
                imageIds.add(obj.src);
            }
        }

        // Load assets (parallelly)
        // IDB 'get' is fast, but individual requests.
        // For MVP, loop is fine.
        const assetTx = db.transaction('assets', 'readonly');
        const assetStore = assetTx.objectStore('assets');

        // We can't do parallel invocations on same transaction easily with idb wrapper sometimes if awaiting? 
        // Actually promise.all works fine with idb.
        const promises = Array.from(imageIds).map(async (assetId) => {
            const assetRec = await assetStore.get(assetId);
            if (assetRec) {
                assets.set(assetId, assetRec.data);
            }
        });

        await Promise.all(promises);
        await assetTx.done;

        return {
            document: proj.document,
            name: proj.name,
            assets
        };
    },

    /**
     * Save a project.
     * document: The document structure (where ImageObj.src MUST be assetId)
     * assets: Map of assetId -> Blob
     */
    async save(document: Document, assets: Map<string, Blob>, name?: string, id?: string): Promise<string> {
        const db = await getDb();
        const projectId = id || randomId();
        const timestamp = Date.now();
        const projectName = name || "Untitled Project";

        // 1. Save Assets
        const assetTx = db.transaction('assets', 'readwrite');
        const assetStore = assetTx.objectStore('assets');

        const assetPromises = Array.from(assets.entries()).map(async ([assetId, blob]) => {
            // We always overwrite (or put) to ensure it exists
            // TODO: Only put if new? For now, put is safe.
            // We know blob type?
            await assetStore.put({
                id: assetId,
                data: blob,
                mimeType: blob.type
            });
        });
        await Promise.all(assetPromises);
        await assetTx.done;

        // 2. Save Project
        await db.put('projects', {
            id: projectId,
            name: projectName,
            updatedAt: timestamp,
            document,
            // thumbnail could be generated here if we had a canvas
        });

        return projectId;
    },

    async delete(id: string): Promise<void> {
        const db = await getDb();
        await db.delete('projects', id);
        // TODO: Garbage collect assets not used by other projects
        // For MVP, we leak assets if deleted.
    }
};
