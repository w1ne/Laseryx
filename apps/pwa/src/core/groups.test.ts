import { describe, expect, it } from "vitest";
import {
  expandSelectionWithGroups,
  findGroupContaining,
  translateMembers,
  groupBounds,
  buildObjectListRows
} from "./groups";
import type { Document, Obj } from "./model";
import { drawLine, emptySketch } from "./sketch";
import { bakeSketch } from "./sketch/bake";

const rect = (id: string, e: number, f: number): Obj => ({
  kind: "shape",
  id,
  layerId: "l1",
  transform: { a: 1, b: 0, c: 0, d: 1, e, f },
  shape: { type: "rect", width: 10, height: 10 }
});

describe("groups", () => {
  it("finds and expands group membership", () => {
    const doc: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "l1", name: "L", visible: true, locked: false }],
      objects: [rect("a", 0, 0), rect("b", 20, 0), rect("c", 40, 0)],
      groups: [{ id: "g1", name: "G", memberIds: ["a", "b"] }]
    };
    expect(findGroupContaining(doc, "a")?.id).toBe("g1");
    expect(expandSelectionWithGroups(doc, ["a"])).toEqual(["a", "b"]);
    expect(expandSelectionWithGroups(doc, ["c"])).toEqual(["c"]);
  });

  it("translates free objects and sketch points", () => {
    let s = emptySketch();
    const d = drawLine(s, { x: 0, y: 0 }, { x: 10, y: 0 });
    s = d.sketch;
    const baked = bakeSketch(s, "l1");
    const free = rect("r1", 5, 5);
    const doc: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "l1", name: "L", visible: true, locked: false }],
      objects: [free, ...baked],
      sketch: s
    };
    const { objects, sketch } = translateMembers(
      doc,
      [free.id, baked[0].id],
      3,
      4
    );
    const moved = objects.find((o) => o.id === "r1")!;
    expect(moved.transform.e).toBe(8);
    expect(moved.transform.f).toBe(9);
    expect(sketch!.points[d.p1.id].x).toBe(3);
    expect(sketch!.points[d.p1.id].y).toBe(4);
  });

  it("groupBounds unions members", () => {
    const objects = [rect("a", 0, 0), rect("b", 20, 10)];
    const b = groupBounds(objects, ["a", "b"])!;
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(30);
    expect(b.maxY).toBe(20);
  });

  it("buildObjectListRows collapses group members to one row", () => {
    const doc: Document = {
      version: 1,
      units: "mm",
      layers: [{ id: "l1", name: "L", visible: true, locked: false }],
      objects: [rect("a", 0, 0), rect("b", 20, 0), rect("c", 40, 0)],
      groups: [{ id: "g1", name: "Rect 1", memberIds: ["a", "b"] }]
    };
    const rows = buildObjectListRows(doc);
    expect(rows).toHaveLength(2); // group + c only
    expect(rows[0]).toMatchObject({ kind: "group", name: "Rect 1" });
    expect(rows[1]).toMatchObject({ kind: "object", objectId: "c" });
  });
});
