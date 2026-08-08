import { describe, it, expect } from "vitest";
import { objectBounds } from "./designGeometry";
import type { Obj } from "../../../core/model";

describe("objectBounds", () => {
  it("bounds a rect shape from transform origin", () => {
    const obj: Obj = {
      kind: "shape",
      id: "r1",
      layerId: "l1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      shape: { type: "rect", width: 30, height: 40 }
    };
    expect(objectBounds(obj)).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });
});
