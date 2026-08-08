import { describe, it, expect } from "vitest";
import {
  boundsOf,
  getObjectSize,
  setObjectSize,
  mirrorHorizontal,
  mirrorVertical,
  rotate90,
  duplicateObject,
  nudgeObject
} from "./objectEdit";
import type { Obj } from "./model";

function rect(e: number, f: number, w: number, h: number): Obj {
  return {
    kind: "shape",
    id: "r1",
    layerId: "l1",
    transform: { a: 1, b: 0, c: 0, d: 1, e, f },
    shape: { type: "rect", width: w, height: h }
  };
}

describe("objectEdit", () => {
  it("getObjectSize for rect", () => {
    expect(getObjectSize(rect(10, 20, 30, 40))).toEqual({ w: 30, h: 40 });
  });

  it("setObjectSize keeps top-left", () => {
    const patch = setObjectSize(rect(10, 20, 30, 40), 50, 60);
    expect(patch?.transform?.e).toBe(10);
    expect(patch?.transform?.f).toBe(20);
    expect(patch && "shape" in patch && patch.shape).toEqual({ type: "rect", width: 50, height: 60 });
  });

  it("mirrorHorizontal flips about center", () => {
    const obj = rect(0, 0, 20, 10);
    // center x = 10; e' = 20 - 0 - 20 = 0 for symmetric... e=0 w=20, e'=2*10-0-20=0
    const patch = mirrorHorizontal(obj);
    expect(patch?.transform?.e).toBe(0);
    // offset rect
    const obj2 = rect(10, 0, 20, 10); // minX=10 maxX=30 cx=20 → e'=40-10-20=10
    expect(mirrorHorizontal(obj2)?.transform?.e).toBe(10);
    const obj3 = rect(0, 0, 10, 10); // cx=5 → e'=10-0-10=0
    expect(mirrorHorizontal(obj3)?.transform?.e).toBe(0);
    const obj4 = rect(5, 0, 10, 10); // min=5 max=15 cx=10 → e'=20-5-10=5
    expect(mirrorHorizontal(obj4)?.transform?.e).toBe(5);
    // non-centered: e=0 w=30, cx=15 → e'=30-0-30=0
    // e=10 w=30 min=10 max=40 cx=25 → e'=50-10-30=10
    // e=0 w=10 placed at left of larger... use e=20 w=10: min20 max30 cx25 → e'=50-20-10=20
    const shifted = rect(20, 5, 10, 10);
    const mir = mirrorHorizontal(shifted)!;
    const after = { ...shifted, ...mir, transform: { ...shifted.transform, ...mir.transform } } as Obj;
    // After mirror, bbox should still span same width around same center
    const b0 = boundsOf(shifted)!;
    const b1 = boundsOf(after)!;
    expect((b0.minX + b0.maxX) / 2).toBeCloseTo((b1.minX + b1.maxX) / 2);
    expect(b1.maxX - b1.minX).toBeCloseTo(b0.maxX - b0.minX);
  });

  it("mirrorVertical flips about center", () => {
    const obj = rect(0, 20, 10, 10); // minY20 maxY30 cy25 → f'=50-20-10=20
    expect(mirrorVertical(obj)?.transform?.f).toBe(20);
  });

  it("rotate90 swaps size around center", () => {
    const obj = rect(0, 0, 40, 20); // cx20 cy10 → after 20x40, min (10,0)
    const patch = rotate90(obj, 1)!;
    expect(patch.shape).toEqual({ type: "rect", width: 20, height: 40 });
    const after = {
      ...obj,
      ...patch,
      transform: { ...obj.transform, ...patch.transform },
      shape: patch.shape
    } as Obj;
    const b = boundsOf(after)!;
    expect((b.minX + b.maxX) / 2).toBeCloseTo(20);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(10);
  });

  it("nudge and duplicate", () => {
    const obj = rect(1, 2, 3, 4);
    expect(nudgeObject(obj, 5, -1).transform?.e).toBe(6);
    const dup = duplicateObject(obj, 10);
    expect(dup.id).not.toBe(obj.id);
    expect(dup.transform.e).toBe(11);
  });
});
