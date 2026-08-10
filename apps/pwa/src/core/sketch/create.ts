import { sketchId } from "./ids";
import type {
  DimValue,
  SketchCircle,
  SketchConstraint,
  SketchDocument,
  SketchEntity,
  SketchLine,
  SketchParameter,
  SketchPoint
} from "./types";
import { emptySketch } from "./types";

export function cloneSketch(s: SketchDocument): SketchDocument {
  return structuredClone(s);
}

/** Stable id for the machine / bed origin (always fixed at 0,0). */
export const ORIGIN_POINT_ID = "pt-origin";
export const ORIGIN_FIX_ID = "c-origin-fix";

/**
 * Ensure a fixed origin point at (0,0) exists so dimensions can measure to it.
 * Origin is never a free solver variable.
 */
export function ensureOrigin(sketch: SketchDocument): SketchDocument {
  let s = sketch;
  const existing = s.points[ORIGIN_POINT_ID];
  if (!existing || existing.x !== 0 || existing.y !== 0) {
    s = {
      ...s,
      points: {
        ...s.points,
        [ORIGIN_POINT_ID]: { id: ORIGIN_POINT_ID, x: 0, y: 0 }
      }
    };
  }
  if (!s.constraints[ORIGIN_FIX_ID]) {
    s = {
      ...s,
      constraints: {
        ...s.constraints,
        [ORIGIN_FIX_ID]: {
          id: ORIGIN_FIX_ID,
          type: "fix",
          pointId: ORIGIN_POINT_ID
        }
      }
    };
  }
  return s;
}

export function ensureSketch(s: SketchDocument | null | undefined): SketchDocument {
  const base = s ? cloneSketch(s) : emptySketch();
  return ensureOrigin(base);
}

export function addPoint(
  sketch: SketchDocument,
  x: number,
  y: number,
  id?: string
): { sketch: SketchDocument; point: SketchPoint } {
  const point: SketchPoint = { id: id ?? sketchId("pt"), x, y };
  return {
    sketch: {
      ...sketch,
      points: { ...sketch.points, [point.id]: point }
    },
    point
  };
}

export function addLine(
  sketch: SketchDocument,
  p1: string,
  p2: string,
  opts?: { construction?: boolean; layerId?: string; id?: string; name?: string }
): { sketch: SketchDocument; line: SketchLine } {
  const line: SketchLine = {
    kind: "line",
    id: opts?.id ?? sketchId("ln"),
    p1,
    p2,
    construction: opts?.construction,
    layerId: opts?.layerId,
    name: opts?.name
  };
  return {
    sketch: {
      ...sketch,
      entities: { ...sketch.entities, [line.id]: line }
    },
    line
  };
}

export function addCircle(
  sketch: SketchDocument,
  center: string,
  r: number,
  opts?: { construction?: boolean; layerId?: string; id?: string; name?: string }
): { sketch: SketchDocument; circle: SketchCircle } {
  const circle: SketchCircle = {
    kind: "circle",
    id: opts?.id ?? sketchId("cir"),
    center,
    r: Math.max(0.05, r),
    construction: opts?.construction,
    layerId: opts?.layerId,
    name: opts?.name
  };
  return {
    sketch: {
      ...sketch,
      entities: { ...sketch.entities, [circle.id]: circle }
    },
    circle
  };
}

/** Draw a line by creating two points + entity. */
export function drawLine(
  sketch: SketchDocument,
  a: { x: number; y: number },
  b: { x: number; y: number },
  opts?: { construction?: boolean; layerId?: string; name?: string }
): { sketch: SketchDocument; line: SketchLine; p1: SketchPoint; p2: SketchPoint } {
  let s = sketch;
  const r1 = addPoint(s, a.x, a.y);
  s = r1.sketch;
  const r2 = addPoint(s, b.x, b.y);
  s = r2.sketch;
  const r3 = addLine(s, r1.point.id, r2.point.id, opts);
  return { sketch: r3.sketch, line: r3.line, p1: r1.point, p2: r2.point };
}

/** Draw circle from center + radius. */
export function drawCircle(
  sketch: SketchDocument,
  center: { x: number; y: number },
  r: number,
  opts?: { construction?: boolean; layerId?: string; name?: string }
): { sketch: SketchDocument; circle: SketchCircle; center: SketchPoint } {
  let s = sketch;
  const c = addPoint(s, center.x, center.y);
  s = c.sketch;
  const cir = addCircle(s, c.point.id, r, opts);
  return { sketch: cir.sketch, circle: cir.circle, center: c.point };
}

/**
 * Axis-aligned rectangle as 4 lines + H/V on each side.
 * Corners: tl → tr → br → bl.
 */
export function drawRect(
  sketch: SketchDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { construction?: boolean; layerId?: string }
): {
  sketch: SketchDocument;
  points: SketchPoint[];
  lines: SketchLine[];
  constraints: SketchConstraint[];
} {
  const x2 = x + w;
  const y2 = y + h;
  let s = sketch;
  const pts: SketchPoint[] = [];
  const corners = [
    { x, y },
    { x: x2, y },
    { x: x2, y: y2 },
    { x, y: y2 }
  ];
  for (const c of corners) {
    const r = addPoint(s, c.x, c.y);
    s = r.sketch;
    pts.push(r.point);
  }
  const lines: SketchLine[] = [];
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0]
  ];
  for (const [i, j] of pairs) {
    const r = addLine(s, pts[i].id, pts[j].id, opts);
    s = r.sketch;
    lines.push(r.line);
  }
  // H on top/bottom, V on left/right
  let constraints: SketchConstraint[] = [];
  const addC = (c: SketchConstraint) => {
    constraints = [...constraints, c];
    s = {
      ...s,
      constraints: { ...s.constraints, [c.id]: c }
    };
  };
  addC({ id: sketchId("c"), type: "horizontal", lineId: lines[0].id });
  addC({ id: sketchId("c"), type: "vertical", lineId: lines[1].id });
  addC({ id: sketchId("c"), type: "horizontal", lineId: lines[2].id });
  addC({ id: sketchId("c"), type: "vertical", lineId: lines[3].id });

  return { sketch: s, points: pts, lines, constraints };
}

export function addConstraint(
  sketch: SketchDocument,
  constraint: Omit<SketchConstraint, "id"> & { id?: string }
): { sketch: SketchDocument; constraint: SketchConstraint } {
  const full = { ...constraint, id: constraint.id ?? sketchId("c") } as SketchConstraint;
  return {
    sketch: {
      ...sketch,
      constraints: { ...sketch.constraints, [full.id]: full }
    },
    constraint: full
  };
}

export function addParameter(
  sketch: SketchDocument,
  name: string,
  value: number,
  id?: string
): { sketch: SketchDocument; parameter: SketchParameter } {
  const parameter: SketchParameter = {
    id: id ?? sketchId("par"),
    name,
    value
  };
  return {
    sketch: {
      ...sketch,
      parameters: { ...sketch.parameters, [parameter.id]: parameter }
    },
    parameter
  };
}

export function setParameterValue(
  sketch: SketchDocument,
  paramId: string,
  value: number
): SketchDocument {
  const p = sketch.parameters[paramId];
  if (!p) return sketch;
  return {
    ...sketch,
    parameters: {
      ...sketch.parameters,
      [paramId]: { ...p, value }
    }
  };
}

export function resolveDimValue(sketch: SketchDocument, v: DimValue): number {
  if (v.kind === "literal") return v.value;
  return sketch.parameters[v.paramId]?.value ?? 0;
}

export function getEntity(sketch: SketchDocument, id: string): SketchEntity | undefined {
  return sketch.entities[id];
}

export function getLine(sketch: SketchDocument, id: string): SketchLine | undefined {
  const e = sketch.entities[id];
  return e?.kind === "line" ? e : undefined;
}

export function getCircle(sketch: SketchDocument, id: string): SketchCircle | undefined {
  const e = sketch.entities[id];
  return e?.kind === "circle" ? e : undefined;
}

export function deleteConstraint(sketch: SketchDocument, id: string): SketchDocument {
  const { [id]: _, ...rest } = sketch.constraints;
  return { ...sketch, constraints: rest };
}

export function deleteEntity(sketch: SketchDocument, id: string): SketchDocument {
  const { [id]: _, ...entities } = sketch.entities;
  // Drop constraints that reference this entity
  const constraints = { ...sketch.constraints };
  for (const [cid, c] of Object.entries(constraints)) {
    if (constraintRefsEntity(c, id)) delete constraints[cid];
  }
  return { ...sketch, entities, constraints };
}

function constraintRefsEntity(c: SketchConstraint, entityId: string): boolean {
  switch (c.type) {
    case "horizontal":
    case "vertical":
    case "length":
      return c.lineId === entityId;
    case "parallel":
    case "perpendicular":
    case "equalLength":
      return c.lineA === entityId || c.lineB === entityId;
    case "equalRadius":
    case "concentric":
      return c.circleA === entityId || c.circleB === entityId;
    case "pointOnLine":
    case "midpoint":
    case "pointLineDistance":
      return c.lineId === entityId;
    case "pointOnCircle":
    case "diameter":
    case "radius":
      return c.circleId === entityId;
    default:
      return false;
  }
}
