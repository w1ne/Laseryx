import { resolveDimValue, getCircle, getLine } from "./create";
import type { SketchConstraint, SketchDocument } from "./types";

export type ResidualFn = (sketch: SketchDocument) => number[];

/** Evaluate all residuals for the constraint set. */
export function evaluateResiduals(sketch: SketchDocument): number[] {
  const out: number[] = [];
  for (const c of Object.values(sketch.constraints)) {
    out.push(...residualFor(sketch, c));
  }
  return out;
}

export function residualFor(sketch: SketchDocument, c: SketchConstraint): number[] {
  const pts = sketch.points;

  switch (c.type) {
    case "fix": {
      // Handled by removing variables; residual always 0 if present
      return [];
    }
    case "coincident": {
      const a = pts[c.a];
      const b = pts[c.b];
      if (!a || !b) return [0, 0];
      return [a.x - b.x, a.y - b.y];
    }
    case "horizontal": {
      const line = getLine(sketch, c.lineId);
      if (!line) return [0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0];
      return [a.y - b.y];
    }
    case "vertical": {
      const line = getLine(sketch, c.lineId);
      if (!line) return [0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0];
      return [a.x - b.x];
    }
    case "parallel": {
      const la = getLine(sketch, c.lineA);
      const lb = getLine(sketch, c.lineB);
      if (!la || !lb) return [0];
      const a1 = pts[la.p1];
      const a2 = pts[la.p2];
      const b1 = pts[lb.p1];
      const b2 = pts[lb.p2];
      if (!a1 || !a2 || !b1 || !b2) return [0];
      const ax = a2.x - a1.x;
      const ay = a2.y - a1.y;
      const bx = b2.x - b1.x;
      const by = b2.y - b1.y;
      // cross product = 0 for parallel
      return [ax * by - ay * bx];
    }
    case "perpendicular": {
      const la = getLine(sketch, c.lineA);
      const lb = getLine(sketch, c.lineB);
      if (!la || !lb) return [0];
      const a1 = pts[la.p1];
      const a2 = pts[la.p2];
      const b1 = pts[lb.p1];
      const b2 = pts[lb.p2];
      if (!a1 || !a2 || !b1 || !b2) return [0];
      const ax = a2.x - a1.x;
      const ay = a2.y - a1.y;
      const bx = b2.x - b1.x;
      const by = b2.y - b1.y;
      return [ax * bx + ay * by];
    }
    case "equalLength": {
      const la = getLine(sketch, c.lineA);
      const lb = getLine(sketch, c.lineB);
      if (!la || !lb) return [0];
      const a1 = pts[la.p1];
      const a2 = pts[la.p2];
      const b1 = pts[lb.p1];
      const b2 = pts[lb.p2];
      if (!a1 || !a2 || !b1 || !b2) return [0];
      const laLen = Math.hypot(a2.x - a1.x, a2.y - a1.y);
      const lbLen = Math.hypot(b2.x - b1.x, b2.y - b1.y);
      return [laLen - lbLen];
    }
    case "equalRadius": {
      const ca = getCircle(sketch, c.circleA);
      const cb = getCircle(sketch, c.circleB);
      if (!ca || !cb) return [0];
      return [ca.r - cb.r];
    }
    case "pointOnLine": {
      const line = getLine(sketch, c.lineId);
      const p = pts[c.pointId];
      if (!line || !p) return [0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0];
      const ax = b.x - a.x;
      const ay = b.y - a.y;
      const len = Math.hypot(ax, ay) || 1;
      // signed distance to infinite line
      const dist = ((p.x - a.x) * ay - (p.y - a.y) * ax) / len;
      return [dist];
    }
    case "pointOnCircle": {
      const cir = getCircle(sketch, c.circleId);
      const p = pts[c.pointId];
      if (!cir || !p) return [0];
      const center = pts[cir.center];
      if (!center) return [0];
      const d = Math.hypot(p.x - center.x, p.y - center.y);
      return [d - cir.r];
    }
    case "midpoint": {
      const line = getLine(sketch, c.lineId);
      const p = pts[c.pointId];
      if (!line || !p) return [0, 0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0, 0];
      return [p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2];
    }
    case "concentric": {
      const ca = getCircle(sketch, c.circleA);
      const cb = getCircle(sketch, c.circleB);
      if (!ca || !cb) return [0, 0];
      const a = pts[ca.center];
      const b = pts[cb.center];
      if (!a || !b) return [0, 0];
      return [a.x - b.x, a.y - b.y];
    }
    case "distance": {
      const a = pts[c.a];
      const b = pts[c.b];
      if (!a || !b) return [0];
      const target = resolveDimValue(sketch, c.value);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      return [d - target];
    }
    case "pointLineDistance": {
      const line = getLine(sketch, c.lineId);
      const p = pts[c.pointId];
      if (!line || !p) return [0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0];
      const ax = b.x - a.x;
      const ay = b.y - a.y;
      const len = Math.hypot(ax, ay) || 1;
      const signed = ((p.x - a.x) * ay - (p.y - a.y) * ax) / len;
      const target = resolveDimValue(sketch, c.value);
      // Match sign of current side so dim can push either way from seed
      const absTarget = Math.abs(target);
      const signedTarget = signed >= 0 ? absTarget : -absTarget;
      return [signed - signedTarget];
    }
    case "length": {
      const line = getLine(sketch, c.lineId);
      if (!line) return [0];
      const a = pts[line.p1];
      const b = pts[line.p2];
      if (!a || !b) return [0];
      const target = resolveDimValue(sketch, c.value);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      return [d - target];
    }
    case "diameter": {
      const cir = getCircle(sketch, c.circleId);
      if (!cir) return [0];
      const target = resolveDimValue(sketch, c.value);
      return [2 * cir.r - target];
    }
    case "radius": {
      const cir = getCircle(sketch, c.circleId);
      if (!cir) return [0];
      const target = resolveDimValue(sketch, c.value);
      return [cir.r - target];
    }
    default:
      return [];
  }
}

export function residualNorm(residuals: number[]): number {
  let s = 0;
  for (const r of residuals) s += r * r;
  return Math.sqrt(s);
}
