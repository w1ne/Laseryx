import { describe, expect, it } from "vitest";
import { createMatingJointPair, fingerJointOutline, hasSelfIntersection } from "./joints";

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
    expect(a.matingOffset).toBeCloseTo(-0.0375);
    expect(b.matingOffset).toBeCloseTo(-0.0375);
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

  it("changes mating shoulder coordinates without changing nominal bounds", () => {
    const counts = { top: 7, right: 7, bottom: 7, left: 7 };
    const exact = fingerJointOutline(40, 30, counts, 3, 0, { top: 0, right: 0, bottom: 0, left: 0 });
    const cleared = fingerJointOutline(40, 30, counts, 3, 0, { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 });
    const mate = fingerJointOutline(40, 30, counts, 3, 1, { top: -0.1, right: -0.1, bottom: -0.1, left: -0.1 });
    expect(cleared.points).not.toEqual(exact.points);
    for (const outline of [exact, cleared, mate]) {
      expect([Math.min(...outline.points.map(({ x }) => x)), Math.max(...outline.points.map(({ x }) => x))]).toEqual([0, 40]);
      expect([Math.min(...outline.points.map(({ y }) => y)), Math.max(...outline.points.map(({ y }) => y))]).toEqual([0, 30]);
      expect(hasSelfIntersection(outline)).toBe(false);
      for (let index = 1; index < outline.points.length - 1; index++) {
        const previous = outline.points[index - 1], current = outline.points[index], next = outline.points[index + 1];
        const first = { x: current.x - previous.x, y: current.y - previous.y };
        const second = { x: next.x - current.x, y: next.y - current.y };
        const collinear = Math.abs(first.x * second.y - first.y * second.x) < 1e-9;
        expect(collinear && first.x * second.x + first.y * second.y < 0).toBe(false);
      }
    }
  });

  it("detects a self-intersecting closed path", () => {
    expect(hasSelfIntersection({ closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }] })).toBe(true);
  });

  it("makes receiving recesses wider than corresponding material tabs by total clearance", () => {
    const measure = (clearance: number) => {
      const pair = createMatingJointPair("source-panel-top", "rear-top", 70, 3, clearance, 10);
      if (!pair.ok) throw new Error(pair.issue.message);
      const [slotJoint, tabJoint] = pair.joints;
      const slotFace = fingerJointOutline(70, 30, { top: 7, right: 7, bottom: 7, left: 7 }, 3, slotJoint.phase, { top: slotJoint.matingOffset, right: 0, bottom: 0, left: 0 });
      const tabFace = fingerJointOutline(70, 30, { top: 7, right: 7, bottom: 7, left: 7 }, 3, tabJoint.phase, { top: tabJoint.matingOffset, right: 0, bottom: 0, left: 0 });
      const horizontalRecesses = (points: typeof slotFace.points) => points.slice(1).flatMap((point, index) => {
        const previous = points[index];
        return previous.y === 3 && point.y === 3 ? [{ start: previous.x, end: point.x }] : [];
      });
      const slots = horizontalRecesses(slotFace.points);
      const mateRecesses = horizontalRecesses(tabFace.points);
      return { slot: slots[0].end - slots[0].start, tab: mateRecesses[1].start - mateRecesses[0].end };
    };
    expect(measure(0).slot).toBeCloseTo(measure(0).tab);
    const loose = measure(0.2);
    expect(loose.slot - loose.tab).toBeCloseTo(0.2);
  });
});
