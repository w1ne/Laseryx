import { describe, expect, it } from "vitest";
import {
  dimLineFromOffset,
  linePerpUnit,
  signedPerpOffset,
  placeFromPerpOffset
} from "./dimAnnotations";

describe("dimAnnotations layout", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 40, y: 0 }; // horizontal line

  it("dim line is parallel to geometry (pure perp offset)", () => {
    const { a2, b2 } = dimLineFromOffset(a, b, 10);
    // Both ends moved by same vector → parallel
    expect(b2.x - a2.x).toBeCloseTo(b.x - a.x);
    expect(b2.y - a2.y).toBeCloseTo(b.y - a.y);
    // Extension is pure perpendicular (vertical for horizontal line)
    expect(a2.x).toBeCloseTo(a.x);
    expect(a2.y).toBeCloseTo(10);
    expect(b2.x).toBeCloseTo(b.x);
    expect(b2.y).toBeCloseTo(10);
  });

  it("signed offset ignores parallel component of place", () => {
    // Place 5 along line + 12 perp
    const place = { x: 20 + 5, y: 12 };
    const o = signedPerpOffset(a, b, place);
    expect(o).toBeCloseTo(12);
    const p = placeFromPerpOffset(a, b, o);
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(12);
  });

  it("works for diagonal lines", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 30, y: 40 }; // len 50
    const n = linePerpUnit(p1, p2);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1);
    // Dot with direction = 0
    expect(n.x * 30 + n.y * 40).toBeCloseTo(0);
    const { a2, b2 } = dimLineFromOffset(p1, p2, 10);
    expect(b2.x - a2.x).toBeCloseTo(30);
    expect(b2.y - a2.y).toBeCloseTo(40);
  });
});
