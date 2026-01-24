import { describe, it, expect } from "vitest";
import { parseGcode } from "./gcodeParser";

describe("parseGcode", () => {
    it("should parse simple G1 cut", () => {
        const gcode = `
    G1 X10 Y10 F1000
    M4 S500
    G1 X20 Y10
    M5
    `;
        const result = parseGcode(gcode);
        expect(result.moves).toHaveLength(2);

        // First move: G1 to 10,10. Laser not technically ON yet (M4 is after).
        // Wait, the order in line matters? 
        // Standard Gcode interpreters read the whole line and apply modal state.
        // BUT, usually M3/M4 are on separate lines or before motion in our generator?
        // Let's re-read the generator output in gcode.ts

        /*
          lines.push(`${dialect.enableLaser} ${dialect.powerCommand}${power}`);
          lines.push(...result.lines); // Which are G1 ...
        */

        // So M4 Sxxx comes BEFORE the G1 lines.

        expect(result.moves[0].type).toBe("travel"); // Initially laser off, moving to 10,10 ?? 
        // Wait, in my test string "G1 X10..." is BEFORE "M4". So it is travel.

        expect(result.moves[1].type).toBe("cut");
        expect(result.moves[1].from).toEqual({ x: 10, y: 10 });
        expect(result.moves[1].to).toEqual({ x: 20, y: 10 });
        expect(result.moves[1].power).toBe(500);
    });

    it("should handle G0 travel", () => {
        const gcode = "G0 X10 Y10";
        const result = parseGcode(gcode);
        expect(result.moves).toHaveLength(1);
        expect(result.moves[0].type).toBe("travel");
        expect(result.moves[0].to).toEqual({ x: 10, y: 10 });
    });

    it("should handle mixed sequence", () => {
        const gcode = `
    G0 X0 Y0
    M4 S1000
    G1 X10 Y0
    G1 X10 Y10
    M5
    G0 X0 Y0
    `;
        const result = parseGcode(gcode);

        // 0: G0 X0Y0 (Travel) -> actually from 0,0 to 0,0 so maybe skipped or 0 length?
        // My parser doesn't filter 0 length moves yet, which is fine.

        // 1: G1 X10 Y0 (Cut)
        // 2: G1 X10 Y10 (Cut)
        // 3: G0 X0 Y0 (Travel)

        // Actually, first line is 'G0 X0 Y0' from 0,0.

        expect(result.moves[0].type).toBe("travel"); // 0->0
        expect(result.moves[1].type).toBe("cut"); // 0,0 -> 10,0
        expect(result.moves[2].type).toBe("cut"); // 10,0 -> 10,10
        expect(result.moves[3].type).toBe("travel"); // 10,10 -> 0,0
    });
});
