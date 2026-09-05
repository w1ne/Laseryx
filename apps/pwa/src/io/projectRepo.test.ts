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

    it('round-trips an enclosure workspace exactly without aliases', async () => {
        const workspace = { version: 1 as const, presets: [{ id: "p", name: "Hole", kind: "circle" as const, dimensions: { diameter: 8 } }], sourcePanel: { id: "panel", name: "Panel", width: 100, height: 80, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 2, parameters: { frontHeight: 30, rearHeight: 35, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: true, selectedClearance: .15 }, sheetLayout: { sheetSize: { width: 210, height: 148 }, orientation: "landscape" as const, margin: 5, gap: 2, parts: [], sheets: [], placements: [], unplacedPartIds: [] } };
        const doc: Document = { ...mockDoc, enclosureWorkspace: workspace };
        const id = await projectRepo.save(doc, new Map(), "Workspace");
        workspace.sourcePanel.width = 999;
        const loaded = await projectRepo.load(id);
        expect(loaded?.document.enclosureWorkspace?.sourcePanel.width).toBe(100);
        expect(loaded?.document.enclosureWorkspace).toEqual({ ...workspace, sourcePanel: { ...workspace.sourcePanel, width: 100 } });
    });

    it('loads old projects unchanged and safely omits malformed workspaces', async () => {
        const oldId = await projectRepo.save(mockDoc, new Map(), "Old");
        expect((await projectRepo.load(oldId))?.document).toEqual(mockDoc);
        const db = await getDb();
        await db.put('projects', { id: 'bad', name: 'Bad', updatedAt: 1, document: { ...mockDoc, enclosureWorkspace: { version: 99 } } as unknown as Document });
        expect((await projectRepo.load('bad'))?.document).toEqual(mockDoc);
        await db.put('projects', { id: 'nested-bad', name: 'Bad', updatedAt: 2, document: { ...mockDoc, enclosureWorkspace: { version: 1, presets: [{ id: 'x' }], sourcePanel: {}, enclosure: {}, coupon: {} } } as unknown as Document });
        expect((await projectRepo.load('nested-bad'))?.document).toEqual(mockDoc);
        const unsafeLayout = { version: 1, presets: [], sourcePanel: { id: 'panel', name: 'Panel', width: 100, height: 80, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: 'box', revision: 0, parameters: { frontHeight: 30, rearHeight: 35, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false }, sheetLayout: { sheetSize: { width: 210, height: 148 }, orientation: 'landscape', margin: 5, gap: 2, parts: [{ id: 'source-panel', width: 100, height: 80 }], sheets: [{ id: 'sheet', x: 0, y: 0, width: 210, height: 148 }], placements: [null], unplacedPartIds: [] } };
        await db.put('projects', { id: 'unsafe-layout', name: 'Bad', updatedAt: 3, document: { ...mockDoc, enclosureWorkspace: unsafeLayout } as unknown as Document });
        expect((await projectRepo.load('unsafe-layout'))?.document).toEqual(mockDoc);
    });

    it('should save and load automation metadata', async () => {
        const camSettings = {
            operations: [
                { id: "op-1", name: "Cut", mode: "line" as const, speed: 1200, power: 55, passes: 2 }
            ]
        };
        const machineProfile = {
            id: "machine-1",
            name: "Machine 1",
            bedMm: { w: 300, h: 200 },
            origin: "frontLeft" as const,
            sRange: { min: 0, max: 1000 },
            laserMode: "M4" as const,
            baudRate: 115200
        };

        const id = await projectRepo.save(mockDoc, new Map(), "Metadata Project", undefined, {
            camSettings,
            machineProfile
        });
        const loaded = await projectRepo.load(id);

        expect(loaded?.camSettings).toEqual(camSettings);
        expect(loaded?.machineProfile).toEqual(machineProfile);
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
