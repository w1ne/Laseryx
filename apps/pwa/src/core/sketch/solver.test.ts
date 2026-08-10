import { describe, expect, it } from "vitest";
import {
  addConstraint,
  addParameter,
  drawCircle,
  drawLine,
  drawRect,
  emptySketch,
  setParameterValue,
  solveSketch
} from "./index";

describe("sketch solver", () => {
  it("enforces horizontal line", () => {
    let s = emptySketch();
    const d = drawLine(s, { x: 0, y: 0 }, { x: 40, y: 5 });
    s = d.sketch;
    // fix start
    s = addConstraint(s, { type: "fix", pointId: d.p1.id }).sketch;
    s = addConstraint(s, { type: "horizontal", lineId: d.line.id }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: d.line.id,
      value: { kind: "literal", value: 40 }
    }).sketch;

    const { sketch, status } = solveSketch(s);
    expect(status.ok).toBe(true);
    const p1 = sketch.points[d.p1.id];
    const p2 = sketch.points[d.p2.id];
    expect(Math.abs(p1.y - p2.y)).toBeLessThan(1e-4);
    expect(Math.abs(Math.hypot(p2.x - p1.x, p2.y - p1.y) - 40)).toBeLessThan(1e-3);
  });

  it("solves rectangle with H/V sides", () => {
    let s = emptySketch();
    const rect = drawRect(s, 10, 20, 50, 30);
    s = rect.sketch;
    // fix one corner
    s = addConstraint(s, { type: "fix", pointId: rect.points[0].id }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: rect.lines[0].id,
      value: { kind: "literal", value: 50 }
    }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: rect.lines[1].id,
      value: { kind: "literal", value: 30 }
    }).sketch;

    // nudge a point off and re-solve
    s = {
      ...s,
      points: {
        ...s.points,
        [rect.points[1].id]: {
          ...s.points[rect.points[1].id],
          y: 25
        }
      }
    };

    const { sketch, status } = solveSketch(s);
    expect(status.ok).toBe(true);
    const tl = sketch.points[rect.points[0].id];
    const tr = sketch.points[rect.points[1].id];
    const br = sketch.points[rect.points[2].id];
    expect(Math.abs(tl.y - tr.y)).toBeLessThan(1e-3);
    expect(Math.abs(tr.x - br.x)).toBeLessThan(1e-3);
    expect(Math.abs(tr.x - tl.x - 50)).toBeLessThan(1e-2);
    expect(Math.abs(br.y - tr.y - 30)).toBeLessThan(1e-2);
  });

  it("diameter parameter drives circle size", () => {
    let s = emptySketch();
    const c = drawCircle(s, { x: 0, y: 0 }, 5);
    s = c.sketch;
    s = addConstraint(s, { type: "fix", pointId: c.center.id }).sketch;
    const par = addParameter(s, "hole_d", 12);
    s = par.sketch;
    s = addConstraint(s, {
      type: "diameter",
      circleId: c.circle.id,
      value: { kind: "param", paramId: par.parameter.id }
    }).sketch;

    let solved = solveSketch(s);
    expect(solved.status.ok).toBe(true);
    expect(solved.sketch.entities[c.circle.id].kind).toBe("circle");
    if (solved.sketch.entities[c.circle.id].kind === "circle") {
      expect(solved.sketch.entities[c.circle.id].r).toBeCloseTo(6, 2);
    }

    s = setParameterValue(solved.sketch, par.parameter.id, 20);
    solved = solveSketch(s);
    expect(solved.status.ok).toBe(true);
    if (solved.sketch.entities[c.circle.id].kind === "circle") {
      expect(solved.sketch.entities[c.circle.id].r).toBeCloseTo(10, 2);
    }
  });

  it("coincident merges two points under motion", () => {
    let s = emptySketch();
    const l1 = drawLine(s, { x: 0, y: 0 }, { x: 30, y: 0 });
    s = l1.sketch;
    const l2 = drawLine(s, { x: 30.5, y: 0.5 }, { x: 60, y: 10 });
    s = l2.sketch;
    s = addConstraint(s, { type: "fix", pointId: l1.p1.id }).sketch;
    s = addConstraint(s, {
      type: "coincident",
      a: l1.p2.id,
      b: l2.p1.id
    }).sketch;
    s = addConstraint(s, { type: "horizontal", lineId: l1.line.id }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: l1.line.id,
      value: { kind: "literal", value: 30 }
    }).sketch;

    const { sketch, status } = solveSketch(s);
    expect(status.ok).toBe(true);
    const a = sketch.points[l1.p2.id];
    const b = sketch.points[l2.p1.id];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-3);
  });

  it("perpendicular + equal length", () => {
    let s = emptySketch();
    const a = drawLine(s, { x: 0, y: 0 }, { x: 40, y: 0 });
    s = a.sketch;
    const b = drawLine(s, { x: 40, y: 0 }, { x: 50, y: 20 });
    s = b.sketch;
    s = addConstraint(s, { type: "fix", pointId: a.p1.id }).sketch;
    s = addConstraint(s, {
      type: "coincident",
      a: a.p2.id,
      b: b.p1.id
    }).sketch;
    s = addConstraint(s, { type: "horizontal", lineId: a.line.id }).sketch;
    s = addConstraint(s, {
      type: "perpendicular",
      lineA: a.line.id,
      lineB: b.line.id
    }).sketch;
    s = addConstraint(s, {
      type: "equalLength",
      lineA: a.line.id,
      lineB: b.line.id
    }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: a.line.id,
      value: { kind: "literal", value: 40 }
    }).sketch;

    const { sketch, status } = solveSketch(s);
    expect(status.ok).toBe(true);
    const p0 = sketch.points[a.p1.id];
    const p1 = sketch.points[a.p2.id];
    const p2 = sketch.points[b.p2.id];
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;
    expect(Math.abs(ax * bx + ay * by)).toBeLessThan(1e-2);
    expect(Math.abs(Math.hypot(ax, ay) - Math.hypot(bx, by))).toBeLessThan(1e-2);
  });
});
