import { describe, expect, it } from "vitest";
import { arrangeParts, packParts, preservePlacements } from "./pack";
import type { PartBounds, SheetLayout } from "./types";

describe("packParts", () => {
  it("packs deterministically onto visible A5 sheets without mutating source bounds", () => {
    const parts: PartBounds[] = [
      { id: "wide", width: 130, height: 60 },
      { id: "rotated", width: 100, height: 140 },
      { id: "small", width: 30, height: 20 },
    ];
    const snapshot = structuredClone(parts);

    const first = packParts(parts, { margin: 5, gap: 2 });
    const second = packParts([...parts].reverse(), { margin: 5, gap: 2 });

    expect(first).toEqual(second);
    expect(first.sheets[0]).toEqual({ id: "sheet-1", x: 0, y: 0, width: 210, height: 148 });
    expect(first.placements.every(({ rotation }) => rotation === 0 || rotation === 90)).toBe(true);
    expect(first.placements.some(({ partId, rotation }) => partId === "rotated" && rotation === 90)).toBe(true);
    expect(first.unplacedPartIds).toEqual([]);
    expect(parts).toEqual(snapshot);
    expect(Object.keys(first.placements[0]).sort()).toEqual(["partId", "rotation", "sheetId", "x", "y"]);
  });

  it("reports parts that cannot fit either orientation", () => {
    const layout = packParts([{ id: "too-large", width: 220, height: 160 }]);
    expect(layout.placements).toEqual([]);
    expect(layout.unplacedPartIds).toEqual(["too-large"]);
    expect(layout.sheets).toHaveLength(1);
  });

  it("honours custom sheet size and orientation and never overlaps or crosses margins", () => {
    const parts = Array.from({ length: 7 }, (_, index) => ({ id: `p${index}`, width: 35, height: 22 }));
    const layout = packParts(parts, { sheetSize: { width: 80, height: 120 }, orientation: "landscape", margin: 4, gap: 3 });
    expect(layout.sheets[0]).toMatchObject({ width: 120, height: 80 });
    for (const placement of layout.placements) {
      const part = parts.find(({ id }) => id === placement.partId)!;
      const width = placement.rotation === 90 ? part.height : part.width;
      const height = placement.rotation === 90 ? part.width : part.height;
      const sheet = layout.sheets.find(({ id }) => id === placement.sheetId)!;
      expect(placement.x).toBeGreaterThanOrEqual(4);
      expect(placement.y).toBeGreaterThanOrEqual(4);
      expect(placement.x + width).toBeLessThanOrEqual(sheet.width - 4);
      expect(placement.y + height).toBeLessThanOrEqual(sheet.height - 4);
    }
    for (let i = 0; i < layout.placements.length; i++) for (let j = i + 1; j < layout.placements.length; j++) {
      const a = layout.placements[i], b = layout.placements[j];
      if (a.sheetId !== b.sheetId) continue;
      const ap = parts.find(({ id }) => id === a.partId)!, bp = parts.find(({ id }) => id === b.partId)!;
      const aw = a.rotation === 90 ? ap.height : ap.width, ah = a.rotation === 90 ? ap.width : ap.height;
      const bw = b.rotation === 90 ? bp.height : bp.width, bh = b.rotation === 90 ? bp.width : bp.height;
      expect(a.x + aw + 3 <= b.x || b.x + bw + 3 <= a.x || a.y + ah + 3 <= b.y || b.y + bh + 3 <= a.y).toBe(true);
    }
  });
});

describe("preservePlacements", () => {
  const oldLayout: SheetLayout = {
    sheetSize: { width: 210, height: 148 }, orientation: "landscape", margin: 5, gap: 2,
    parts: [{ id: "keep", width: 20, height: 10 }, { id: "remove", width: 10, height: 10 }, { id: "resize", width: 10, height: 10 }],
    sheets: [{ id: "manual-sheet", x: 11, y: 13, width: 210, height: 148 }],
    placements: [
      { partId: "keep", sheetId: "manual-sheet", x: 30, y: 40, rotation: 90 },
      { partId: "remove", sheetId: "manual-sheet", x: 80, y: 80, rotation: 0 },
      { partId: "resize", sheetId: "manual-sheet", x: 100, y: 80, rotation: 0 },
    ], unplacedPartIds: [],
  };

  it("retains valid manual transforms and sheet bounds while removing and invalidating changed IDs", () => {
    const next = preservePlacements(oldLayout, [
      { id: "keep", width: 20, height: 10 },
      { id: "resize", width: 12, height: 10 },
      { id: "new", width: 5, height: 5 },
    ]);
    expect(next.sheets).toEqual(oldLayout.sheets);
    expect(next.placements).toEqual([{ partId: "keep", sheetId: "manual-sheet", x: 30, y: 40, rotation: 90 }]);
    expect(next.unplacedPartIds).toEqual(["new", "resize"]);
  });

  it("invalidates every placement involved in an overlap or outside a sheet", () => {
    const bad: SheetLayout = {
      ...oldLayout,
      parts: [{ id: "a", width: 20, height: 20 }, { id: "b", width: 20, height: 20 }, { id: "edge", width: 20, height: 20 }],
      placements: [
        { partId: "a", sheetId: "manual-sheet", x: 10, y: 10, rotation: 0 },
        { partId: "b", sheetId: "manual-sheet", x: 20, y: 20, rotation: 0 },
        { partId: "edge", sheetId: "manual-sheet", x: 195, y: 10, rotation: 0 },
      ],
    };
    const next = preservePlacements(bad, bad.parts);
    expect(next.placements).toEqual([]);
    expect(next.unplacedPartIds).toEqual(["a", "b", "edge"]);
  });

  it("arrange intentionally replaces manual placement with deterministic packing", () => {
    const arranged = arrangeParts(oldLayout);
    expect(arranged).toEqual(packParts(oldLayout.parts, { sheetSize: oldLayout.sheetSize, orientation: oldLayout.orientation, margin: oldLayout.margin, gap: oldLayout.gap }));
    expect(arranged.placements).not.toContainEqual(oldLayout.placements[0]);
  });
});
