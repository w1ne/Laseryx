import type { Obj } from "./model";
import { expandMacro } from "./macros/expand";
import type { SketchDocument } from "./sketch/types";
import { roundMm } from "./util";

export type SnapPt = {
  x: number;
  y: number;
  kind: "grid" | "end" | "mid" | "center";
  /** When set, snapping here can create a coincident joint to this sketch point. */
  sketchPointId?: string;
};

const applyT = (
  p: { x: number; y: number },
  t: { a: number; b: number; c: number; d: number; e: number; f: number }
) => ({
  x: p.x * t.a + p.y * t.c + t.e,
  y: p.x * t.b + p.y * t.d + t.f
});

/** Snap targets from sketch graph (preferred — carries point ids). */
export function collectSketchSnapPoints(sketch: SketchDocument | null | undefined): SnapPt[] {
  if (!sketch) return [];
  const out: SnapPt[] = [];

  for (const p of Object.values(sketch.points)) {
    out.push({ x: p.x, y: p.y, kind: "end", sketchPointId: p.id });
  }

  for (const e of Object.values(sketch.entities)) {
    if (e.kind === "line") {
      const a = sketch.points[e.p1];
      const b = sketch.points[e.p2];
      if (a && b) {
        out.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          kind: "mid"
        });
      }
    } else if (e.kind === "circle") {
      const c = sketch.points[e.center];
      if (c) {
        out.push({ x: c.x, y: c.y, kind: "center", sketchPointId: c.id });
      }
    }
  }

  return out;
}

/** Collect endpoints / mids / centers from free (non-sketch) document objects. */
export function collectObjectSnapPoints(objects: Obj[]): SnapPt[] {
  const out: SnapPt[] = [];

  for (const obj of objects) {
    // Skip baked sketch objects — use collectSketchSnapPoints instead
    if (obj.id.startsWith("sketch:")) continue;

    if (obj.kind === "shape" && obj.shape.type === "rect") {
      const { e, f } = obj.transform;
      const w = obj.shape.width;
      const h = obj.shape.height;
      const corners = [
        { x: e, y: f },
        { x: e + w, y: f },
        { x: e, y: f + h },
        { x: e + w, y: f + h }
      ];
      for (const c of corners) out.push({ ...c, kind: "end" });
      out.push({ x: e + w / 2, y: f + h / 2, kind: "center" });
      out.push({ x: e + w / 2, y: f, kind: "mid" });
      out.push({ x: e + w / 2, y: f + h, kind: "mid" });
      out.push({ x: e, y: f + h / 2, kind: "mid" });
      out.push({ x: e + w, y: f + h / 2, kind: "mid" });
      continue;
    }

    if (obj.kind === "path" && obj.points.length > 0) {
      const world = obj.points.map((p) => applyT(p, obj.transform));
      for (const p of world) out.push({ ...p, kind: "end" });
      if (world.length >= 2) {
        for (let i = 0; i < world.length - 1; i++) {
          out.push({
            x: (world[i].x + world[i + 1].x) / 2,
            y: (world[i].y + world[i + 1].y) / 2,
            kind: "mid"
          });
        }
      }
      continue;
    }

    if (obj.kind === "macro") {
      if (obj.defId === "mount-hole" || obj.defId === "button") {
        out.push({ x: obj.transform.e, y: obj.transform.f, kind: "center" });
      }
      const expanded = expandMacro(obj);
      if (expanded.ok) {
        for (const path of expanded.paths) {
          if (path.points.length === 0) continue;
          const pts = path.points;
          out.push({ ...pts[0], kind: "end" });
          out.push({ ...pts[pts.length - 1], kind: "end" });
          if (pts.length > 2) {
            const mid = pts[Math.floor(pts.length / 2)];
            out.push({ ...mid, kind: "mid" });
          }
        }
      }
    }
  }

  return out;
}

/** Combined snap targets for the canvas. */
export function collectSnapPoints(
  objects: Obj[],
  sketch?: SketchDocument | null
): SnapPt[] {
  return [...collectSketchSnapPoints(sketch), ...collectObjectSnapPoints(objects)];
}

export type SnapResult = {
  x: number;
  y: number;
  snapped: boolean;
  source?: SnapPt;
};

/**
 * Snap world point to geometry (priority) then optional grid.
 * Prefer targets that carry sketchPointId when distances are equal.
 */
export function snapPoint(
  x: number,
  y: number,
  targets: SnapPt[],
  opts?: { gridMm?: number; thresholdMm?: number }
): SnapResult {
  const threshold = opts?.thresholdMm ?? 1.5;
  let best: SnapPt | null = null;
  let bestD = threshold;

  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestD - 1e-9) {
      bestD = d;
      best = t;
    } else if (Math.abs(d - bestD) < 1e-9 && t.sketchPointId && !best?.sketchPointId) {
      best = t;
    }
  }

  if (best) {
    return { x: roundMm(best.x), y: roundMm(best.y), snapped: true, source: best };
  }

  const grid = opts?.gridMm;
  if (grid && grid > 0) {
    const gx = Math.round(x / grid) * grid;
    const gy = Math.round(y / grid) * grid;
    if (Math.hypot(gx - x, gy - y) <= threshold) {
      return {
        x: roundMm(gx),
        y: roundMm(gy),
        snapped: true,
        source: { x: gx, y: gy, kind: "grid" }
      };
    }
  }

  return { x, y, snapped: false };
}
