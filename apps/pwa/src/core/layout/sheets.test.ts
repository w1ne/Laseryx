import { describe, expect, it } from "vitest";
import { expandSheetBoundaries } from "./sheets";

describe("expandSheetBoundaries", () => {
  it("creates construction-only PathObj-compatible reference rectangles", () => {
    const sheets = [{ id: "sheet-7", x: 12, y: 34, width: 210, height: 148 }] as const;
    expect(expandSheetBoundaries(sheets, "references")).toEqual([{
      kind: "path", id: "sheet-boundary:sheet-7", layerId: "references", closed: true, construction: true,
      name: "Sheet sheet-7", transform: { a: 1, b: 0, c: 0, d: 1, e: 12, f: 34 },
      points: [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 148 }, { x: 0, y: 148 }],
    }]);
    expect(sheets).toEqual([{ id: "sheet-7", x: 12, y: 34, width: 210, height: 148 }]);
  });
});
