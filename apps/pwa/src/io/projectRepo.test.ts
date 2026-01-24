// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import "fake-indexeddb/auto"; // Mocks global functions
import { projectRepo } from './projectRepo';
import { getDb } from './db';
import { Document } from '../core/model';

describe('projectRepo', () => {
    beforeEach(async () => {
        // Clear DB between tests
        // fake-indexeddb keeps state in memory?
        // We can just delete the DB
        const db = await getDb();
        // Clear object stores
        const tx = db.transaction(['projects', 'assets'], 'readwrite');
        await tx.objectStore('projects').clear();
        await tx.objectStore('assets').clear();
        await tx.done;
    });

    const mockDoc: Document = {
        version: 1,
        units: "mm",
        layers: [],
        objects: []
    };

    it('should list empty projects initially', async () => {
        const list = await projectRepo.list();
        expect(list).toEqual([]);
    });

    it('should save and list a project', async () => {
        const id = await projectRepo.save(mockDoc, new Map(), "My Project");
        expect(id).toBeDefined();

        const list = await projectRepo.list();
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe(id);
        expect(list[0].name).toBe("My Project");
    });

    it('should load a saved project', async () => {
        const id = await projectRepo.save(mockDoc, new Map(), "Test Load");
        const loaded = await projectRepo.load(id);

        expect(loaded).not.toBeNull();
        expect(loaded?.name).toBe("Test Load");
        expect(loaded?.document).toEqual(mockDoc);
    });

    it('should save and load assets', async () => {
        const blob = new Blob(["fake-image-data"], { type: "text/plain" });
        const assetId = "asset-1";
        const assets = new Map<string, Blob>();
        assets.set(assetId, blob);

        const docWithImage: Document = {
            ...mockDoc,
            objects: [{
                kind: "image",
                id: "img1",
                layerId: "L1",
                transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                width: 100,
                height: 100,
                src: assetId // referencing the asset
            }]
        };

        const id = await projectRepo.save(docWithImage, assets, "Asset Project");

        const loaded = await projectRepo.load(id);
        expect(loaded).toBeDefined();
        expect(loaded?.assets.size).toBe(1);
        expect(loaded?.assets.get(assetId)).toBeDefined();

        // Verify blob content
        const loadedBlob = loaded?.assets.get(assetId);
        expect(loadedBlob?.size).toBe(blob.size);
        expect(await loadedBlob?.text()).toBe("fake-image-data");
    });

    it('should delete a project', async () => {
        const id = await projectRepo.save(mockDoc, new Map(), "To Delete");
        let list = await projectRepo.list();
        expect(list).toHaveLength(1);

        await projectRepo.delete(id);

        list = await projectRepo.list();
        expect(list).toHaveLength(0);

        const loaded = await projectRepo.load(id);
        expect(loaded).toBeNull();
    });
});
