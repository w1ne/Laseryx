import { describe, it, expect } from "vitest";
import { generateRasterToolpath } from "./raster";
import { CamSettings, Operation } from "./model";

describe("generateRasterToolpath", () => {
    it("should generate horizontal lines for a black image", () => {
        // 2x2 black image
        const data = new Uint8ClampedArray([
            0, 0, 0, 255, 0, 0, 0, 255,
            0, 0, 0, 255, 0, 0, 0, 255
        ]);
        const imageData = {
            width: 2,
            height: 2,
            data,
            colorSpace: "srgb" as PredefinedColorSpace
        };

        const op: Operation = {
            id: "op1", type: "rasterEngrave", speedMmMin: 1000, powerPct: 50, passes: 1,
            order: "insideOut"
        };

        const bbox = { x: 0, y: 0, w: 10, h: 10 };

        const paths = generateRasterToolpath(imageData, { operations: [op] }, op, bbox);

        // Should have 2 paths (one for each row)
        // Row 1 (y=0): 0 to 10
        // Row 2 (y=5): 10 to 0 (bidirectional)

        expect(paths.length).toBe(2);
        expect(paths[0].points[0].y).toBe(0);
        expect(paths[1].points[0].y).toBe(5);
    });

    it("should skip white pixels", () => {
        // 3x1 image: Black, White, Black
        const data = new Uint8ClampedArray([
            0, 0, 0, 255,
            255, 255, 255, 255,
            0, 0, 0, 255
        ]);
        const imageData = { width: 3, height: 1, data, colorSpace: "srgb" as PredefinedColorSpace };
        const op: Operation = {
            id: "op1", type: "rasterEngrave", speedMmMin: 1000, powerPct: 50, passes: 1,
            order: "insideOut"
        };
        const bbox = { x: 0, y: 0, w: 30, h: 10 };

        const paths = generateRasterToolpath(imageData, { operations: [op] }, op, bbox);

        // Should have 2 separate segments on the same row
        expect(paths.length).toBe(2);
    });
});
