import { describe, it, expect } from "vitest";
import {
    applyTransform,
    composeTransforms,
    computeBounds,
    polygonArea,
    pathLength,
    IDENTITY_TRANSFORM
} from "./geom";
import { Point, Transform } from "./model";

describe("geom", () => {
    describe("applyTransform", () => {
        it("should apply identity transform correctly", () => {
            const p: Point = { x: 10, y: 20 };
            expect(applyTransform(p, IDENTITY_TRANSFORM)).toEqual(p);
        });

        it("should apply translation correctly", () => {
            const p: Point = { x: 10, y: 20 };
            const t: Transform = { ...IDENTITY_TRANSFORM, e: 5, f: -5 };
            expect(applyTransform(p, t)).toEqual({ x: 15, y: 15 });
        });

        it("should apply scaling correctly", () => {
            const p: Point = { x: 10, y: 20 };
            const t: Transform = { ...IDENTITY_TRANSFORM, a: 2, d: 3 };
            expect(applyTransform(p, t)).toEqual({ x: 20, y: 60 });
        });
    });

    describe("composeTransforms", () => {
        it("should compose two translations", () => {
            const t1: Transform = { ...IDENTITY_TRANSFORM, e: 10, f: 0 };
            const t2: Transform = { ...IDENTITY_TRANSFORM, e: 0, f: 20 };
            const composed = composeTransforms(t1, t2);
            expect(composed.e).toBe(10);
            expect(composed.f).toBe(20);
        });
    });

    describe("computeBounds", () => {
        it("should return empty bounds for no paths", () => {
            expect(computeBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
        });

        it("should compute correct bounds for multiple paths", () => {
            const paths = [
                { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], closed: false },
                { points: [{ x: -5, y: 5 }, { x: 5, y: 15 }], closed: false },
            ];
            expect(computeBounds(paths)).toEqual({ minX: -5, minY: 0, maxX: 10, maxY: 15 });
        });
    });

    describe("polygonArea", () => {
        it("should return 0 for less than 3 points", () => {
            expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
        });

        it("should compute area of a rectangle", () => {
            const rect = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ];
            expect(Math.abs(polygonArea(rect))).toBe(100);
        });
    });

    describe("pathLength", () => {
        it("should return 0 for < 2 points", () => {
            expect(pathLength({ points: [{ x: 0, y: 0 }], closed: false })).toBe(0);
        });

        it("should compute length of a simple path", () => {
            const path = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false };
            expect(pathLength(path)).toBe(10);
        });

        it("should include closing segment if closed", () => {
            const path = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true };
            // 10 + 10 + sqrt(10^2 + 10^2) = 20 + 14.14 = 34.14
            expect(pathLength(path)).toBeCloseTo(34.14, 2);
        });
    });
});
