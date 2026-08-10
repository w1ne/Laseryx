import type { SketchConstraint, SketchDocument, SketchEntityId } from "./types";
import { entityIdFromObjectId, isSketchObjectId } from "./bake";
import { resolveDimValue } from "./create";
import { formatMm } from "../util";

export type ConstraintLabel = {
  id: string;
  type: SketchConstraint["type"];
  glyph: string;
  label: string;
  /** Entity ids this constraint touches (for canvas placement). */
  entityIds: string[];
};

function entityName(sketch: SketchDocument, id: string): string {
  const e = sketch.entities[id];
  if (!e) return id.slice(0, 8);
  if (e.name?.trim()) return e.name.trim();
  return e.kind === "line" ? "Line" : "Circle";
}

/** Which sketch entity ids does this constraint reference? */
export function constraintEntityIds(c: SketchConstraint, sketch: SketchDocument): string[] {
  const pts = sketch.points;
  const linesUsingPoint = (pid: string) =>
    Object.values(sketch.entities)
      .filter((e) => e.kind === "line" && (e.p1 === pid || e.p2 === pid))
      .map((e) => e.id);
  const circlesUsingPoint = (pid: string) =>
    Object.values(sketch.entities)
      .filter((e) => e.kind === "circle" && e.center === pid)
      .map((e) => e.id);

  switch (c.type) {
    case "horizontal":
    case "vertical":
    case "length":
      return [c.lineId];
    case "parallel":
    case "perpendicular":
    case "equalLength":
      return [c.lineA, c.lineB];
    case "equalRadius":
    case "concentric":
      return [c.circleA, c.circleB];
    case "diameter":
    case "radius":
      return [c.circleId];
    case "pointOnLine":
    case "midpoint":
    case "pointLineDistance":
      return [c.lineId, ...linesUsingPoint(c.pointId), ...circlesUsingPoint(c.pointId)];
    case "pointOnCircle":
      return [c.circleId, ...linesUsingPoint(c.pointId)];
    case "fix":
      return [...linesUsingPoint(c.pointId), ...circlesUsingPoint(c.pointId)];
    case "coincident":
      return [
        ...linesUsingPoint(c.a),
        ...linesUsingPoint(c.b),
        ...circlesUsingPoint(c.a),
        ...circlesUsingPoint(c.b)
      ];
    case "distance":
      return [
        ...linesUsingPoint(c.a),
        ...linesUsingPoint(c.b),
        ...circlesUsingPoint(c.a),
        ...circlesUsingPoint(c.b)
      ];
    default:
      return [];
  }
}

export function constraintGlyph(type: SketchConstraint["type"]): string {
  switch (type) {
    case "horizontal":
      return "H";
    case "vertical":
      return "V";
    case "coincident":
      return "⊙";
    case "parallel":
      return "∥";
    case "perpendicular":
      return "⊥";
    case "equalLength":
      return "=";
    case "equalRadius":
      return "R=";
    case "concentric":
      return "◎";
    case "fix":
      return "📌";
    case "length":
      return "L";
    case "diameter":
      return "Ø";
    case "radius":
      return "R";
    case "distance":
      return "D";
    case "pointLineDistance":
      return "⊥d";
    case "midpoint":
      return "M";
    case "pointOnLine":
      return "·—";
    case "pointOnCircle":
      return "·○";
    default:
      return "?";
  }
}

export function describeConstraint(sketch: SketchDocument, c: SketchConstraint): string {
  const n = (id: string) => entityName(sketch, id);
  switch (c.type) {
    case "horizontal":
      return `Horizontal · ${n(c.lineId)}`;
    case "vertical":
      return `Vertical · ${n(c.lineId)}`;
    case "coincident":
      return "Coincident endpoints";
    case "parallel":
      return `Parallel · ${n(c.lineA)} ∥ ${n(c.lineB)}`;
    case "perpendicular":
      return `Perpendicular · ${n(c.lineA)} ⊥ ${n(c.lineB)}`;
    case "equalLength":
      return `Equal length · ${n(c.lineA)} = ${n(c.lineB)}`;
    case "equalRadius":
      return `Equal radius · ${n(c.circleA)} = ${n(c.circleB)}`;
    case "concentric":
      return `Concentric · ${n(c.circleA)} ◎ ${n(c.circleB)}`;
    case "fix":
      return "Fixed point";
    case "length": {
      const v = resolveDimValue(sketch, c.value);
      return `Length · ${n(c.lineId)} = ${formatMm(v)} mm`;
    }
    case "diameter": {
      const v = resolveDimValue(sketch, c.value);
      return `Diameter · ${n(c.circleId)} = Ø${formatMm(v)}`;
    }
    case "radius": {
      const v = resolveDimValue(sketch, c.value);
      return `Radius · ${n(c.circleId)} = ${formatMm(v)} mm`;
    }
    case "distance": {
      const v = resolveDimValue(sketch, c.value);
      return `Distance = ${formatMm(v)} mm`;
    }
    case "pointLineDistance": {
      const v = resolveDimValue(sketch, c.value);
      return `Point–line = ${formatMm(Math.abs(v))} mm · ${n(c.lineId)}`;
    }
    case "midpoint":
      return `Midpoint · ${n(c.lineId)}`;
    case "pointOnLine":
      return `Point on line · ${n(c.lineId)}`;
    case "pointOnCircle":
      return `Point on circle · ${n(c.circleId)}`;
    default:
      return (c as SketchConstraint).type;
  }
}

export function listAllConstraints(sketch: SketchDocument): ConstraintLabel[] {
  return Object.values(sketch.constraints).map((c) => ({
    id: c.id,
    type: c.type,
    glyph: constraintGlyph(c.type),
    label: describeConstraint(sketch, c),
    entityIds: [...new Set(constraintEntityIds(c, sketch))]
  }));
}

/** Constraints that touch any of the given sketch entity ids. */
export function listConstraintsForEntities(
  sketch: SketchDocument,
  entityIds: string[]
): ConstraintLabel[] {
  if (entityIds.length === 0) return listAllConstraints(sketch);
  const set = new Set(entityIds);
  return listAllConstraints(sketch).filter((c) => c.entityIds.some((id) => set.has(id)));
}

export function objectIdsToEntityIds(objectIds: string[]): SketchEntityId[] {
  return objectIds
    .filter(isSketchObjectId)
    .map((id) => entityIdFromObjectId(id))
    .filter((id): id is string => !!id);
}

/** Midpoint of an entity for placing a glyph (world mm). */
export function entityGlyphPoint(
  sketch: SketchDocument,
  entityId: string
): { x: number; y: number } | null {
  const e = sketch.entities[entityId];
  if (!e) return null;
  if (e.kind === "line") {
    const a = sketch.points[e.p1];
    const b = sketch.points[e.p2];
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  if (e.kind === "circle") {
    const c = sketch.points[e.center];
    if (!c) return null;
    return { x: c.x + e.r * 0.7, y: c.y - e.r * 0.7 };
  }
  return null;
}
