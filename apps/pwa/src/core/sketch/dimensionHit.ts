import type { SketchDocument } from "./types";
import type { DimPick } from "./dimension";
import { getLine, ORIGIN_POINT_ID } from "./create";

/** Screen-space pick radius (px) — Fusion-like; keep generous for laser UI zoom. */
export const DIM_HIT_PX = 22;
/** Slightly larger hit for origin so it's easy to measure toward 0,0. */
export const ORIGIN_HIT_PX = 28;

/**
 * Machine-world → screen. Uses the Y-up world group when present so picks match geometry.
 */
export function worldToClient(
  svg: SVGSVGElement,
  x: number,
  y: number
): { x: number; y: number } | null {
  const world =
    (svg.querySelector("[data-testid='machine-world']") as SVGGElement | null) ||
    (svg.querySelector("g.machine-world") as SVGGElement | null);
  const el: SVGGraphicsElement = world ?? svg;
  const ctm = el.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const c = pt.matrixTransform(ctm);
  return { x: c.x, y: c.y };
}

/**
 * Hit-test sketch geometry in **screen pixels** so zoom doesn't break picking.
 */
export function pickDimAtClient(
  sketch: SketchDocument,
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): DimPick | null {
  const hit = DIM_HIT_PX;

  // 0) Origin first — measure toward machine zero
  const origin = sketch.points[ORIGIN_POINT_ID];
  if (origin) {
    const c = worldToClient(svg, origin.x, origin.y);
    if (c) {
      const d = Math.hypot(c.x - clientX, c.y - clientY);
      if (d <= ORIGIN_HIT_PX) return { kind: "point", pointId: ORIGIN_POINT_ID };
    }
  }

  // 1) Points / endpoints (priority)
  let bestPt: { id: string; d: number } | null = null;
  for (const p of Object.values(sketch.points)) {
    if (p.id === ORIGIN_POINT_ID) continue;
    const c = worldToClient(svg, p.x, p.y);
    if (!c) continue;
    const d = Math.hypot(c.x - clientX, c.y - clientY);
    if (d <= hit && (!bestPt || d < bestPt.d)) bestPt = { id: p.id, d };
  }
  if (bestPt) return { kind: "point", pointId: bestPt.id };

  // 2) Circles — center or rim in screen space
  let bestCir: { id: string; d: number } | null = null;
  for (const e of Object.values(sketch.entities)) {
    if (e.kind !== "circle") continue;
    const center = sketch.points[e.center];
    if (!center) continue;
    const c0 = worldToClient(svg, center.x, center.y);
    const cR = worldToClient(svg, center.x + e.r, center.y);
    if (!c0 || !cR) continue;
    const rPx = Math.hypot(cR.x - c0.x, cR.y - c0.y);
    const dCenter = Math.hypot(c0.x - clientX, c0.y - clientY);
    const dRim = Math.abs(dCenter - rPx);
    const d = Math.min(dCenter, dRim);
    if (d <= hit && (!bestCir || d < bestCir.d)) bestCir = { id: e.id, d };
  }
  if (bestCir) return { kind: "circle", circleId: bestCir.id };

  // 3) Lines — distance to segment in screen space
  let bestLine: { id: string; d: number } | null = null;
  for (const e of Object.values(sketch.entities)) {
    if (e.kind !== "line") continue;
    const a = sketch.points[e.p1];
    const b = sketch.points[e.p2];
    if (!a || !b) continue;
    const ca = worldToClient(svg, a.x, a.y);
    const cb = worldToClient(svg, b.x, b.y);
    if (!ca || !cb) continue;
    const d = distToSegmentPx(clientX, clientY, ca.x, ca.y, cb.x, cb.y);
    if (d <= hit && (!bestLine || d < bestLine.d)) bestLine = { id: e.id, d };
  }
  if (bestLine) return { kind: "line", lineId: bestLine.id };

  // 4) World-space fallback (if CTM flaky or zoom extreme) — machine-world coords
  const worldEl =
    (svg.querySelector("[data-testid='machine-world']") as SVGGElement | null) ||
    (svg.querySelector("g.machine-world") as SVGGElement | null) ||
    svg;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = worldEl.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  const wx = local.x;
  const wy = local.y;
  const worldHit = Math.max(8, (Math.min(svg.viewBox.baseVal.width || 400, svg.viewBox.baseVal.height || 400) * 0.03));

  let bestW: { pick: DimPick; d: number } | null = null;
  for (const p of Object.values(sketch.points)) {
    const d = Math.hypot(p.x - wx, p.y - wy);
    if (d <= worldHit && (!bestW || d < bestW.d)) bestW = { pick: { kind: "point", pointId: p.id }, d };
  }
  for (const e of Object.values(sketch.entities)) {
    if (e.kind === "line") {
      const a = sketch.points[e.p1];
      const b = sketch.points[e.p2];
      if (!a || !b) continue;
      const d = distToSegmentWorld(wx, wy, a.x, a.y, b.x, b.y);
      if (d <= worldHit && (!bestW || d < bestW.d)) bestW = { pick: { kind: "line", lineId: e.id }, d };
    } else if (e.kind === "circle") {
      const c = sketch.points[e.center];
      if (!c) continue;
      const d = Math.min(Math.hypot(c.x - wx, c.y - wy), Math.abs(Math.hypot(c.x - wx, c.y - wy) - e.r));
      if (d <= worldHit && (!bestW || d < bestW.d)) bestW = { pick: { kind: "circle", circleId: e.id }, d };
    }
  }
  return bestW?.pick ?? null;
}

function distToSegmentWorld(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function distToSegmentPx(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

export function highlightGeom(
  sketch: SketchDocument,
  pick: DimPick
): { kind: "point"; x: number; y: number } | { kind: "line"; x1: number; y1: number; x2: number; y2: number } | { kind: "circle"; cx: number; cy: number; r: number } | null {
  if (pick.kind === "point") {
    const p = sketch.points[pick.pointId];
    return p ? { kind: "point", x: p.x, y: p.y } : null;
  }
  if (pick.kind === "line") {
    const line = getLine(sketch, pick.lineId);
    if (!line) return null;
    const a = sketch.points[line.p1];
    const b = sketch.points[line.p2];
    if (!a || !b) return null;
    return { kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  const e = sketch.entities[pick.circleId];
  if (!e || e.kind !== "circle") return null;
  const c = sketch.points[e.center];
  if (!c) return null;
  return { kind: "circle", cx: c.x, cy: c.y, r: e.r };
}
