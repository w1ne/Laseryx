import { describe, expect, it } from "vitest";
import { nextAutoName, objectListLabel, groupListLabel } from "./objectLabels";
import type { Document, Obj } from "./model";

const docOf = (objects: Obj[], groups: Document["groups"] = []): Document => ({
  version: 1,
  units: "mm",
  layers: [{ id: "l1", name: "L", visible: true, locked: false }],
  objects,
  groups
});

const line = (id: string, x2: number, name?: string): Obj => ({
  kind: "path",
  id,
  layerId: "l1",
  closed: false,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  points: [
    { x: 10, y: 20 },
    { x: x2, y: 20 }
  ],
  name
});

const rect = (id: string, w: number, h: number, e = 0, f = 0, name?: string): Obj => ({
  kind: "shape",
  id,
  layerId: "l1",
  transform: { a: 1, b: 0, c: 0, d: 1, e, f },
  shape: { type: "rect", width: w, height: h },
  name
});

describe("objectLabels", () => {
  it("builds scannable labels with size and position", () => {
    const a = line("l1", 60);
    const doc = docOf([a]);
    const label = objectListLabel(a, doc);
    expect(label).toMatch(/Line 1/);
    expect(label).toMatch(/50/);
    expect(label).toMatch(/@10/);
  });

  it("prefers custom name", () => {
    const a = line("l1", 60, "Front edge");
    expect(objectListLabel(a, docOf([a]))).toMatch(/^Front edge/);
  });

  it("sequences Line 1, Line 2", () => {
    const a = line("a", 40);
    const b = line("b", 50);
    const doc = docOf([a, b]);
    expect(objectListLabel(a, doc)).toMatch(/Line 1/);
    expect(objectListLabel(b, doc)).toMatch(/Line 2/);
  });

  it("nextAutoName increments", () => {
    const doc = docOf([line("a", 10, "Line 1"), rect("b", 10, 10, 0, 0, "Rect 1")]);
    expect(nextAutoName(doc, "Line")).toBe("Line 2");
    expect(nextAutoName(doc, "Rect")).toBe("Rect 2");
  });

  it("group label includes size", () => {
    const a = rect("a", 40, 30, 5, 5);
    const b = rect("b", 10, 10, 35, 25);
    const doc = docOf([a, b], [{ id: "g1", name: "Rect 1", memberIds: ["a", "b"] }]);
    const label = groupListLabel(doc.groups![0], doc);
    expect(label).toMatch(/Rect 1/);
    expect(label).toMatch(/×/);
  });
});
