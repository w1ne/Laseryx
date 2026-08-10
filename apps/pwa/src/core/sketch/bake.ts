import type { PathObj, Point } from "../model";
import type { SketchDocument, SketchEntity } from "./types";

const CIRCLE_SEGMENTS = 48;

/** Stable object id for a sketch entity. */
export function sketchObjectId(entityId: string): string {
  return `sketch:${entityId}`;
}

export function isSketchObjectId(id: string): boolean {
  return id.startsWith("sketch:");
}

export function entityIdFromObjectId(id: string): string | null {
  if (!isSketchObjectId(id)) return null;
  return id.slice("sketch:".length);
}

function circlePoints(cx: number, cy: number, r: number, segments = CIRCLE_SEGMENTS): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/**
 * Expand sketch entities to PathObj list for CAM / display.
 * Uses identity transform and world coordinates.
 */
export function bakeSketch(
  sketch: SketchDocument,
  defaultLayerId: string
): PathObj[] {
  const out: PathObj[] = [];

  for (const ent of Object.values(sketch.entities) as SketchEntity[]) {
    const layerId = ent.layerId ?? defaultLayerId;
    if (ent.kind === "line") {
      const p1 = sketch.points[ent.p1];
      const p2 = sketch.points[ent.p2];
      if (!p1 || !p2) continue;
      out.push({
        kind: "path",
        id: sketchObjectId(ent.id),
        layerId,
        closed: false,
        transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        points: [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p2.y }
        ],
        construction: ent.construction,
        name: ent.name
      });
      continue;
    }

    if (ent.kind === "circle") {
      const c = sketch.points[ent.center];
      if (!c) continue;
      out.push({
        kind: "path",
        id: sketchObjectId(ent.id),
        layerId,
        closed: true,
        transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        points: circlePoints(c.x, c.y, ent.r),
        construction: ent.construction,
        name: ent.name
      });
    }
  }

  return out;
}
