import type { SketchConstraint, SketchDocument } from "./types";
import { getLine, resolveDimValue } from "./create";
import { formatMm } from "../util";

export type Pt = { x: number; y: number };

export type DimAnnotation = {
  id: string;
  kind: "length" | "distance" | "pointLineDistance" | "diameter";
  /** Geometry anchors in world mm */
  a: Pt;
  b: Pt;
  /** Label / dim-line midpoint (world mm) */
  place: Pt;
  /** Dim line endpoints (always parallel to a→b for linear dims) */
  a2: Pt;
  b2: Pt;
  valueMm: number;
  label: string;
  /** Signed display offset used for this layout */
  offsetMm: number;
};

/**
 * Unit perpendicular to segment a→b (left-hand / CCW).
 * Dim line sits at a + perp*offset, b + perp*offset → always parallel to geometry.
 */
export function linePerpUnit(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Signed distance of `place` from segment mid along the perpendicular. */
export function signedPerpOffset(a: Pt, b: Pt, place: Pt): number {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const n = linePerpUnit(a, b);
  return (place.x - mx) * n.x + (place.y - my) * n.y;
}

/** Place point on pure perpendicular from mid (Fusion linear dim). */
export function placeFromPerpOffset(a: Pt, b: Pt, offsetMm: number): Pt {
  const n = linePerpUnit(a, b);
  return {
    x: (a.x + b.x) / 2 + n.x * offsetMm,
    y: (a.y + b.y) / 2 + n.y * offsetMm
  };
}

/** Dim line endpoints: pure translation of anchors along perp → parallel to line. */
export function dimLineFromOffset(a: Pt, b: Pt, offsetMm: number): { a2: Pt; b2: Pt; place: Pt } {
  const n = linePerpUnit(a, b);
  const a2 = { x: a.x + n.x * offsetMm, y: a.y + n.y * offsetMm };
  const b2 = { x: b.x + n.x * offsetMm, y: b.y + n.y * offsetMm };
  const place = {
    x: (a2.x + b2.x) / 2,
    y: (a2.y + b2.y) / 2
  };
  return { a2, b2, place };
}

/**
 * Build Fusion-style linear/diameter annotations from dimensional constraints.
 */
export function listDimAnnotations(sketch: SketchDocument): DimAnnotation[] {
  const out: DimAnnotation[] = [];
  let i = 0;
  for (const c of Object.values(sketch.constraints)) {
    const ann = annotationFor(sketch, c, i++);
    if (ann) out.push(ann);
  }
  return out;
}

function defaultOffset(idx: number): number {
  return 8 + (idx % 4) * 3;
}

function annotationFor(
  sketch: SketchDocument,
  c: SketchConstraint,
  idx: number
): DimAnnotation | null {
  if (c.type === "length") {
    const line = getLine(sketch, c.lineId);
    if (!line) return null;
    const p1 = sketch.points[line.p1];
    const p2 = sketch.points[line.p2];
    if (!p1 || !p2) return null;
    const v = resolveDimValue(sketch, c.value);
    const offsetMm = c.offsetMm ?? defaultOffset(idx);
    const { a2, b2, place } = dimLineFromOffset(p1, p2, offsetMm);
    return {
      id: c.id,
      kind: "length",
      a: p1,
      b: p2,
      a2,
      b2,
      place,
      valueMm: v,
      label: formatMm(v),
      offsetMm
    };
  }

  if (c.type === "distance") {
    const p1 = sketch.points[c.a];
    const p2 = sketch.points[c.b];
    if (!p1 || !p2) return null;
    const v = resolveDimValue(sketch, c.value);
    const offsetMm = c.offsetMm ?? defaultOffset(idx);
    const { a2, b2, place } = dimLineFromOffset(p1, p2, offsetMm);
    return {
      id: c.id,
      kind: "distance",
      a: p1,
      b: p2,
      a2,
      b2,
      place,
      valueMm: v,
      label: formatMm(v),
      offsetMm
    };
  }

  if (c.type === "pointLineDistance") {
    const line = getLine(sketch, c.lineId);
    const p = sketch.points[c.pointId];
    if (!line || !p) return null;
    const la = sketch.points[line.p1];
    const lb = sketch.points[line.p2];
    if (!la || !lb) return null;
    const foot = projectPointToLine(p, la, lb);
    const v = resolveDimValue(sketch, c.value);
    // Dim measures point→foot (perp to parent). offsetMm shifts along parent line.
    const dx = lb.x - la.x;
    const dy = lb.y - la.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const offsetMm = c.offsetMm ?? 0;
    const a = { x: p.x + ux * offsetMm, y: p.y + uy * offsetMm };
    const b = { x: foot.x + ux * offsetMm, y: foot.y + uy * offsetMm };
    // Side nudge so arrows/label sit next to the measurement segment
    const n = linePerpUnit(a, b);
    const side = 4;
    const a2 = { x: a.x + n.x * side, y: a.y + n.y * side };
    const b2 = { x: b.x + n.x * side, y: b.y + n.y * side };
    const place = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
    return {
      id: c.id,
      kind: "pointLineDistance",
      a,
      b,
      a2,
      b2,
      place,
      valueMm: Math.abs(v),
      label: formatMm(Math.abs(v)),
      offsetMm
    };
  }

  if (c.type === "diameter") {
    const e = sketch.entities[c.circleId];
    if (!e || e.kind !== "circle") return null;
    const c0 = sketch.points[e.center];
    if (!c0) return null;
    const v = resolveDimValue(sketch, c.value);
    const r = Math.max(e.r, v / 2);
    const extra = c.offsetMm ?? 4;
    // Horizontal diameter, dim line offset upward (parallel to diam chord)
    const a = { x: c0.x - r, y: c0.y };
    const b = { x: c0.x + r, y: c0.y };
    const offsetMm = extra;
    const { a2, b2, place } = dimLineFromOffset(a, b, -offsetMm);
    return {
      id: c.id,
      kind: "diameter",
      a,
      b,
      a2,
      b2,
      place,
      valueMm: v,
      label: `Ø${formatMm(v)}`,
      offsetMm
    };
  }

  return null;
}

function projectPointToLine(p: Pt, a: Pt, b: Pt): Pt {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  return { x: a.x + t * abx, y: a.y + t * aby };
}
