import { describe, expect, it } from "vitest";
import {
  DEFAULT_DROP,
  MIN_DRAG_MM,
  resolveDrawGesture
} from "./SketchDrawLayer";

describe("resolveDrawGesture", () => {
  it("keeps a real drag as-is", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 50, y: 60 };
    const r = resolveDrawGesture("rect", a, b);
    expect(r.kind).toBe("drag");
    expect(r.a).toEqual(a);
    expect(r.b).toEqual(b);
  });

  it("turns a tiny click into a default-size rect drop", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 10.1, y: 20.1 };
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(MIN_DRAG_MM);
    const r = resolveDrawGesture("rect", a, b);
    expect(r.kind).toBe("drop");
    expect(r.a).toEqual(a);
    expect(r.b.x - r.a.x).toBe(DEFAULT_DROP.rect.w);
    expect(r.b.y - r.a.y).toBe(DEFAULT_DROP.rect.h);
  });

  it("drops a default circle radius from center", () => {
    const a = { x: 0, y: 0 };
    const r = resolveDrawGesture("circle", a, a);
    expect(r.kind).toBe("drop");
    const diameter = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y) * 2;
    expect(diameter).toBeCloseTo(DEFAULT_DROP.circleDiameter);
  });

  it("drops a horizontal default line", () => {
    const a = { x: 5, y: 5 };
    const r = resolveDrawGesture("line", a, a);
    expect(r.kind).toBe("drop");
    expect(r.b.x - r.a.x).toBe(DEFAULT_DROP.lineLength);
    expect(r.b.y).toBe(a.y);
  });

  it("drops default slot and round-rect sizes", () => {
    const a = { x: 0, y: 0 };
    const slot = resolveDrawGesture("slot", a, a);
    expect(slot.b.x - slot.a.x).toBe(DEFAULT_DROP.slot.w);
    expect(slot.b.y - slot.a.y).toBe(DEFAULT_DROP.slot.h);

    const rr = resolveDrawGesture("round-rect", a, a);
    expect(rr.b.x - rr.a.x).toBe(DEFAULT_DROP.roundRect.w);
    expect(rr.b.y - rr.a.y).toBe(DEFAULT_DROP.roundRect.h);
  });
});
