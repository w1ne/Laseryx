import { describe, expect, it } from "vitest";
import { createMatingJointPair, fingerJointOutline } from "./joints";

describe("enclosure edge joints", () => {
  it("creates paired opposite-phase edges with stock-depth fingers", () => {
    const result = createMatingJointPair("source-bottom", "base-front", 160, 3, 0.15, 8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [a, b] = result.joints;
    expect(a.pairId).toBe(b.pairId);
    expect(a.segmentCount).toBe(b.segmentCount);
    expect(a.nominalLength).toBe(b.nominalLength);
    expect(a.phase).not.toBe(b.phase);
    expect(a.depth).toBe(3);
    expect(b.depth).toBe(3);
    expect(a.matingOffset).toBeCloseTo(0.075);
    expect(b.matingOffset).toBeCloseTo(-0.075);
  });

  it("returns a structured failure for an edge shorter than three target fingers", () => {
    expect(createMatingJointPair("a", "b", 20, 3, 0, 8)).toMatchObject({ ok: false, issue: { code: "edge-too-short", edgeIds: ["a", "b"] } });
  });

  it("keeps clearance out of dimensions and makes a closed bounded outline", () => {
    const outline = fingerJointOutline(160, 100, { top: 11, right: 11, bottom: 11, left: 11 }, 3, 0);
    expect(outline.closed).toBe(true);
    expect([Math.min(...outline.points.map(({ x }) => x)), Math.max(...outline.points.map(({ x }) => x))]).toEqual([0, 160]);
    expect([Math.min(...outline.points.map(({ y }) => y)), Math.max(...outline.points.map(({ y }) => y))]).toEqual([0, 100]);
  });
});
