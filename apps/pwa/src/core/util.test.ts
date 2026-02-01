import { describe, it, expect } from "vitest";
import { formatNumber, updateOperation, updateLayer, randomId } from "./util";
import { Operation, Layer } from "./model";

describe("util", () => {
    describe("formatNumber", () => {
        it("should format finite numbers to 2 decimal places", () => {
            expect(formatNumber(10)).toBe("10.00");
            expect(formatNumber(10.1)).toBe("10.10");
            expect(formatNumber(10.123)).toBe("10.12");
            expect(formatNumber(10.126)).toBe("10.13");
        });

        it("should return '0.00' for non-finite numbers", () => {
            expect(formatNumber(NaN)).toBe("0.00");
            expect(formatNumber(Infinity)).toBe("0.00");
            expect(formatNumber(-Infinity)).toBe("0.00");
        });
    });

    describe("updateOperation", () => {
        it("should update the correct operation by id", () => {
            const ops: Operation[] = [
                { id: "1", name: "Op 1", mode: "line", speed: 100, power: 10, passes: 1 },
                { id: "2", name: "Op 2", mode: "fill", speed: 200, power: 20, passes: 2 },
            ];
            const updated = updateOperation(ops, "1", (op) => ({ ...op, speed: 150 }));
            expect(updated[0].speed).toBe(150);
            expect(updated[1].speed).toBe(200);
        });

        it("should return the same array if id is not found", () => {
            const ops: Operation[] = [
                { id: "1", name: "Op 1", mode: "line", speed: 100, power: 10, passes: 1 },
            ];
            const updated = updateOperation(ops, "2", (op) => ({ ...op, speed: 150 }));
            expect(updated).toEqual(ops);
        });
    });

    describe("updateLayer", () => {
        it("should update the correct layer by id", () => {
            const layers: Layer[] = [
                { id: "1", name: "Layer 1", visible: true, locked: false },
                { id: "2", name: "Layer 2", visible: false, locked: true },
            ];
            const updated = updateLayer(layers, "2", (l) => ({ ...l, visible: true }));
            expect(updated[0].visible).toBe(true);
            expect(updated[1].visible).toBe(true);
        });
    });

    describe("randomId", () => {
        it("should return a string of expected format", () => {
            const id = randomId();
            expect(typeof id).toBe("string");
            expect(id.length).toBeGreaterThan(0);
        });

        it("should generate different ids", () => {
            const id1 = randomId();
            const id2 = randomId();
            expect(id1).not.toBe(id2);
        });
    });
});
