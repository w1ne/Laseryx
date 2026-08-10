import { describe, expect, it } from "vitest";
import { collectSnapPoints, collectSketchSnapPoints, snapPoint } from "./snap";
import type { Obj } from "./model";
import { drawLine, emptySketch } from "./sketch";

const line: Obj = {
  kind: "path",
  id: "l1",
  layerId: "ly",
  closed: false,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  points: [
    { x: 0, y: 0 },
    { x: 40, y: 0 }
  ]
};

const rect: Obj = {
  kind: "shape",
  id: "r1",
  layerId: "ly",
  transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
  shape: { type: "rect", width: 30, height: 20 }
};

describe("snap", () => {
  it("collects line endpoints and mid", () => {
    const pts = collectSnapPoints([line]);
    expect(pts.some((p) => p.x === 0 && p.y === 0 && p.kind === "end")).toBe(true);
    expect(pts.some((p) => p.x === 40 && p.y === 0 && p.kind === "end")).toBe(true);
    expect(pts.some((p) => p.x === 20 && p.y === 0 && p.kind === "mid")).toBe(true);
  });

  it("snaps to nearby endpoint", () => {
    const targets = collectSnapPoints([line, rect]);
    const s = snapPoint(0.4, 0.3, targets, { thresholdMm: 1.5 });
    expect(s.snapped).toBe(true);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });

  it("snaps to grid when no geometry nearby", () => {
    const s = snapPoint(10.4, 20.6, [], { gridMm: 1, thresholdMm: 1.5 });
    expect(s.snapped).toBe(true);
    expect(s.x).toBe(10);
    expect(s.y).toBe(21);
  });

  it("sketch snap points carry point ids for coincident", () => {
    const d = drawLine(emptySketch(), { x: 5, y: 5 }, { x: 25, y: 5 });
    const pts = collectSketchSnapPoints(d.sketch);
    const hit = pts.find((p) => p.x === 5 && p.y === 5);
    expect(hit?.sketchPointId).toBe(d.p1.id);
  });
});
