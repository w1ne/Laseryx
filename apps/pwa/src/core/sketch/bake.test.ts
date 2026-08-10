import { describe, expect, it } from "vitest";
import { bakeSketch, isSketchObjectId, sketchObjectId } from "./bake";
import { drawCircle, drawLine, emptySketch } from "./index";
import { syncDocumentSketch } from "./sync";
import type { Document } from "../model";

describe("bakeSketch", () => {
  it("bakes line and circle to paths", () => {
    let s = emptySketch();
    const l = drawLine(s, { x: 0, y: 0 }, { x: 10, y: 0 });
    s = l.sketch;
    const c = drawCircle(s, { x: 5, y: 5 }, 3);
    s = c.sketch;
    const paths = bakeSketch(s, "layer-1");
    expect(paths).toHaveLength(2);
    expect(paths.every((p) => isSketchObjectId(p.id))).toBe(true);
    expect(paths[0].closed).toBe(false);
    expect(paths[0].points).toHaveLength(2);
    const cir = paths.find((p) => p.id === sketchObjectId(c.circle.id))!;
    expect(cir.closed).toBe(true);
    expect(cir.points.length).toBeGreaterThan(8);
  });

  it("syncDocumentSketch merges bake into document", () => {
    let s = emptySketch();
    const l = drawLine(s, { x: 1, y: 2 }, { x: 11, y: 2 });
    s = l.sketch;
    const doc: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "layer-1", name: "L1", visible: true, locked: false }],
      objects: [
        {
          kind: "shape",
          id: "shape-legacy",
          layerId: "layer-1",
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          shape: { type: "rect", width: 5, height: 5 }
        }
      ],
      sketch: s
    };
    const { document, status } = syncDocumentSketch(doc, { skipSolve: true });
    expect(status).toBeNull();
    expect(document.objects.some((o) => o.id === "shape-legacy")).toBe(true);
    expect(document.objects.some((o) => o.id === sketchObjectId(l.line.id))).toBe(true);
  });
});
