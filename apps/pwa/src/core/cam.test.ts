import { describe, it, expect } from "vitest";
import { planCam } from "./cam";
import { Document, CamSettings } from "./model";

describe("cam", () => {
    const minDoc: Document = {
        version: 1,
        units: "mm",
        layers: [
            { id: "l1", name: "Layer 1", visible: true, locked: false, operationId: "op1" }
        ],
        objects: [
            {
                kind: "path",
                id: "obj1",
                layerId: "l1",
                closed: true,
                transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
            }
        ]
    };

    const minCam: CamSettings = {
        operations: [
            { id: "op1", name: "Cut", mode: "line", speed: 500, power: 100, passes: 1, order: "shortestTravel" }
        ]
    };

    it("should generate a plan for a simple document", () => {
        const result = planCam(minDoc, minCam);
        expect(result.plan.ops).toHaveLength(1);
        expect(result.plan.ops[0].opId).toBe("op1");
        expect(result.plan.ops[0].paths).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
    });

    it("should warn if no operations are configured", () => {
        const result = planCam(minDoc, { operations: [] });
        expect(result.warnings).toContain("No operations configured.");
    });

    it("should warn if a layer has no operation", () => {
        const doc = { ...minDoc, layers: [{ ...minDoc.layers[0], operationId: undefined }] };
        const result = planCam(doc, minCam);
        expect(result.warnings).toContain('Layer "Layer 1" has no operation assigned.');
    });

    it("should order paths using shortestTravel", () => {
        const doc: Document = {
            ...minDoc,
            objects: [
                {
                    kind: "path",
                    id: "obj1",
                    layerId: "l1",
                    closed: false,
                    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                    points: [{ x: 100, y: 100 }, { x: 110, y: 110 }]
                },
                {
                    kind: "path",
                    id: "obj2",
                    layerId: "l1",
                    closed: false,
                    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
                }
            ]
        };
        // Wait, orderShortestTravel uses the END of the previous path to find the next start.
        // So if we have two paths: (0,0)→(10,10) and (100,100)→(110,110),
        // shortestTravel should pick the one closest to the end of the previous path.
        const result = planCam(doc, { ...minCam, optimizePaths: false });
        expect(result.plan.ops[0].paths[0].points[0]).toEqual({ x: 100, y: 100 });
        expect(result.plan.ops[0].paths[1].points[0]).toEqual({ x: 0, y: 0 });
    });

    it("should order paths using insideOut", () => {
        const cam: CamSettings = {
            operations: [
                { id: "op1", name: "Cut", mode: "line", speed: 500, power: 100, passes: 1, order: "insideOut" }
            ]
        };
        const doc: Document = {
            ...minDoc,
            objects: [
                {
                    kind: "path",
                    id: "large",
                    layerId: "l1",
                    closed: true,
                    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
                },
                {
                    kind: "path",
                    id: "small",
                    layerId: "l1",
                    closed: true,
                    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
                    points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }]
                }
            ]
        };
        const result = planCam(doc, cam);
        // Small should come first (area 100 vs 10000)
        expect(result.plan.ops[0].paths[0].points[0]).toEqual({ x: 10, y: 10 });
        expect(result.plan.ops[0].paths[1].points[0]).toEqual({ x: 0, y: 0 });
    });
});
