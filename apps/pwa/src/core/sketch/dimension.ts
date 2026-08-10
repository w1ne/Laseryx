import type { SketchDocument, SketchPointId, SketchEntityId } from "./types";
import { getLine, resolveDimValue } from "./create";
import { roundMm } from "../util";

/** What the user clicked while placing a dimension (Fusion-style). */
export type DimPick =
  | { kind: "point"; pointId: SketchPointId }
  | { kind: "line"; lineId: SketchEntityId }
  | { kind: "circle"; circleId: SketchEntityId };

export type DimCreateResult =
  | {
      ok: true;
      constraint:
        | {
            type: "distance";
            a: SketchPointId;
            b: SketchPointId;
            value: { kind: "literal"; value: number };
          }
        | {
            type: "pointLineDistance";
            pointId: SketchPointId;
            lineId: SketchEntityId;
            value: { kind: "literal"; value: number };
          }
        | {
            type: "length";
            lineId: SketchEntityId;
            value: { kind: "literal"; value: number };
          }
        | {
            type: "diameter";
            circleId: SketchEntityId;
            value: { kind: "literal"; value: number };
          };
      measuredMm: number;
      summary: string;
    }
  | { ok: false; reason: string };

function distPointPoint(
  sketch: SketchDocument,
  a: string,
  b: string
): number | null {
  const pa = sketch.points[a];
  const pb = sketch.points[b];
  if (!pa || !pb) return null;
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

function distPointLine(
  sketch: SketchDocument,
  pointId: string,
  lineId: string
): number | null {
  const line = getLine(sketch, lineId);
  const p = sketch.points[pointId];
  if (!line || !p) return null;
  const a = sketch.points[line.p1];
  const b = sketch.points[line.p2];
  if (!a || !b) return null;
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const len = Math.hypot(ax, ay) || 1;
  return Math.abs(((p.x - a.x) * ay - (p.y - a.y) * ax) / len);
}

/** Prefer endpoint of line closest to a reference world point (or mid). */
export function nearestEndpoint(
  sketch: SketchDocument,
  lineId: string,
  near?: { x: number; y: number }
): SketchPointId | null {
  const line = getLine(sketch, lineId);
  if (!line) return null;
  const a = sketch.points[line.p1];
  const b = sketch.points[line.p2];
  if (!a || !b) return null;
  if (!near) return line.p1;
  const da = Math.hypot(a.x - near.x, a.y - near.y);
  const db = Math.hypot(b.x - near.x, b.y - near.y);
  return da <= db ? line.p1 : line.p2;
}

/**
 * Build a dimensional constraint from two Fusion-style picks.
 * Optional valueMm: if omitted, uses current measured distance.
 */
export function createDimensionBetween(
  sketch: SketchDocument,
  first: DimPick,
  second: DimPick | null,
  valueMm?: number
): DimCreateResult {
  // Single pick: line length or circle diameter
  if (!second) {
    if (first.kind === "line") {
      const line = getLine(sketch, first.lineId);
      if (!line) return { ok: false, reason: "Line not found" };
      const measured = distPointPoint(sketch, line.p1, line.p2);
      if (measured == null) return { ok: false, reason: "Missing points" };
      const v = roundMm(valueMm ?? measured);
      return {
        ok: true,
        measuredMm: measured,
        summary: `Length ${v} mm`,
        constraint: {
          type: "length",
          lineId: first.lineId,
          value: { kind: "literal", value: Math.max(0.1, v) }
        }
      };
    }
    if (first.kind === "circle") {
      const cir = sketch.entities[first.circleId];
      if (!cir || cir.kind !== "circle") return { ok: false, reason: "Circle not found" };
      const measured = cir.r * 2;
      const v = roundMm(valueMm ?? measured);
      return {
        ok: true,
        measuredMm: measured,
        summary: `Diameter Ø${v}`,
        constraint: {
          type: "diameter",
          circleId: first.circleId,
          value: { kind: "literal", value: Math.max(0.5, v) }
        }
      };
    }
    return { ok: false, reason: "Select a second point or line for distance" };
  }

  // Point–point
  if (first.kind === "point" && second.kind === "point") {
    const measured = distPointPoint(sketch, first.pointId, second.pointId);
    if (measured == null) return { ok: false, reason: "Missing points" };
    const v = roundMm(valueMm ?? measured);
    return {
      ok: true,
      measuredMm: measured,
      summary: `Distance ${v} mm`,
      constraint: {
        type: "distance",
        a: first.pointId,
        b: second.pointId,
        value: { kind: "literal", value: Math.max(0, v) }
      }
    };
  }

  // Point–line (either order)
  if (first.kind === "point" && second.kind === "line") {
    const measured = distPointLine(sketch, first.pointId, second.lineId);
    if (measured == null) return { ok: false, reason: "Missing geometry" };
    const v = roundMm(valueMm ?? measured);
    return {
      ok: true,
      measuredMm: measured,
      summary: `Point–line ${v} mm`,
      constraint: {
        type: "pointLineDistance",
        pointId: first.pointId,
        lineId: second.lineId,
        value: { kind: "literal", value: Math.max(0, v) }
      }
    };
  }
  if (first.kind === "line" && second.kind === "point") {
    return createDimensionBetween(sketch, second, first, valueMm);
  }

  // Line–line → distance between nearest endpoints (common Fusion fallback)
  if (first.kind === "line" && second.kind === "line") {
    const la = getLine(sketch, first.lineId);
    const lb = getLine(sketch, second.lineId);
    if (!la || !lb) return { ok: false, reason: "Line not found" };
    const endsA = [la.p1, la.p2];
    const endsB = [lb.p1, lb.p2];
    let best = { a: endsA[0], b: endsB[0], d: Infinity };
    for (const ea of endsA) {
      for (const eb of endsB) {
        const d = distPointPoint(sketch, ea, eb);
        if (d != null && d < best.d) best = { a: ea, b: eb, d };
      }
    }
    if (!Number.isFinite(best.d)) return { ok: false, reason: "Cannot measure" };
    // If nearly parallel, prefer point–line from mid of A to B
    const a1 = sketch.points[la.p1];
    const a2 = sketch.points[la.p2];
    const b1 = sketch.points[lb.p1];
    const b2 = sketch.points[lb.p2];
    if (a1 && a2 && b1 && b2) {
      const ax = a2.x - a1.x;
      const ay = a2.y - a1.y;
      const bx = b2.x - b1.x;
      const by = b2.y - b1.y;
      const cross = Math.abs(ax * by - ay * bx);
      const parallelish = cross < 0.15 * (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
      if (parallelish) {
        const mid: SketchPointId = la.p1;
        const measured = distPointLine(sketch, mid, second.lineId);
        if (measured != null) {
          const v = roundMm(valueMm ?? measured);
          return {
            ok: true,
            measuredMm: measured,
            summary: `Line spacing ${v} mm`,
            constraint: {
              type: "pointLineDistance",
              pointId: mid,
              lineId: second.lineId,
              value: { kind: "literal", value: Math.max(0, v) }
            }
          };
        }
      }
    }
    const v = roundMm(valueMm ?? best.d);
    return {
      ok: true,
      measuredMm: best.d,
      summary: `Distance ${v} mm`,
      constraint: {
        type: "distance",
        a: best.a,
        b: best.b,
        value: { kind: "literal", value: Math.max(0, v) }
      }
    };
  }

  // Point–circle → radial distance from center (not full diameter tool)
  if (first.kind === "point" && second.kind === "circle") {
    const cir = sketch.entities[second.circleId];
    if (!cir || cir.kind !== "circle") return { ok: false, reason: "Circle not found" };
    const measured = distPointPoint(sketch, first.pointId, cir.center);
    if (measured == null) return { ok: false, reason: "Missing points" };
    const v = roundMm(valueMm ?? measured);
    return {
      ok: true,
      measuredMm: measured,
      summary: `Distance to center ${v} mm`,
      constraint: {
        type: "distance",
        a: first.pointId,
        b: cir.center,
        value: { kind: "literal", value: Math.max(0, v) }
      }
    };
  }
  if (first.kind === "circle" && second.kind === "point") {
    return createDimensionBetween(sketch, second, first, valueMm);
  }

  // Circle alone already handled; circle + line → center to line
  if (first.kind === "circle" && second.kind === "line") {
    const cir = sketch.entities[first.circleId];
    if (!cir || cir.kind !== "circle") return { ok: false, reason: "Circle not found" };
    return createDimensionBetween(
      sketch,
      { kind: "point", pointId: cir.center },
      second,
      valueMm
    );
  }
  if (first.kind === "line" && second.kind === "circle") {
    return createDimensionBetween(sketch, second, first, valueMm);
  }

  return { ok: false, reason: "Cannot dimension these two picks" };
}

export function measurePick(
  sketch: SketchDocument,
  pick: DimPick
): { x: number; y: number } | null {
  if (pick.kind === "point") {
    const p = sketch.points[pick.pointId];
    return p ? { x: p.x, y: p.y } : null;
  }
  if (pick.kind === "line") {
    const line = getLine(sketch, pick.lineId);
    if (!line) return null;
    const a = sketch.points[line.p1];
    const b = sketch.points[line.p2];
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const cir = sketch.entities[pick.circleId];
  if (!cir || cir.kind !== "circle") return null;
  const c = sketch.points[cir.center];
  return c ? { x: c.x, y: c.y } : null;
}

// silence unused resolve if tree-shakes
void resolveDimValue;
