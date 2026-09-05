import type { Point, PolylinePath } from "../model";
import type { EdgeJoint, EnclosureValidationIssue } from "./types";

export function chooseJointSegmentCount(length: number, targetWidth: number): number {
  let count = Math.round(length / targetWidth);
  if (count % 2 === 0) count += 1;
  return count;
}

export function createMatingJointPair(firstId: string, secondId: string, nominalLength: number, depth: number, clearance: number, targetWidth: number): { ok: true; joints: [EdgeJoint, EdgeJoint] } | { ok: false; issue: EnclosureValidationIssue } {
  const segmentCount = chooseJointSegmentCount(nominalLength, targetWidth);
  if (nominalLength < 3 * targetWidth || segmentCount < 3) return { ok: false, issue: { code: "edge-too-short", edgeIds: [firstId, secondId], message: `${firstId} and ${secondId} are too short for at least three fingers` } };
  const pairId = `${firstId}--${secondId}`;
  const make = (id: string, mateId: string, phase: 0 | 1, matingOffset: number): EdgeJoint => {
    const split = id.lastIndexOf("-");
    return { id, pairId, panelId: id.slice(0, split) as EdgeJoint["panelId"], edge: id.slice(split + 1) as EdgeJoint["edge"], mateId, nominalLength, segmentCount, phase, depth, matingOffset };
  };
  return { ok: true, joints: [make(firstId, secondId, 0, clearance / 2), make(secondId, firstId, 1, -clearance / 2)] };
}

function jointedEdge(start: Point, end: Point, count: number, depth: number, phase: 0 | 1, matingOffset = 0): Point[] {
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const inward = { x: -dy / length, y: dx / length };
  const tangent = { x: dx / length, y: dy / length };
  const points: Point[] = [{ ...start }];
  for (let i = 0; i < count; i++) {
    const a = { x: start.x + dx * i / count, y: start.y + dy * i / count };
    const b = { x: start.x + dx * (i + 1) / count, y: start.y + dy * (i + 1) / count };
    // Corner spans stay on the nominal boundary so perpendicular fingers cannot cross.
    if (i > 0 && i < count - 1 && (i + phase) % 2 === 0) {
      const startShift = Math.max(-i * length / count, matingOffset);
      const endShift = Math.min((count - i - 1) * length / count, -matingOffset);
      points.push(
        { x: a.x + tangent.x * startShift + inward.x * depth, y: a.y + tangent.y * startShift + inward.y * depth },
        { x: b.x + tangent.x * endShift + inward.x * depth, y: b.y + tangent.y * endShift + inward.y * depth }
      );
    }
    points.push(b);
  }
  return points;
}

export function fingerJointPolygon(vertices: Point[], counts: number[], depth: number, phase: 0 | 1 | Array<0 | 1>, matingOffsets: number[] = []): PolylinePath {
  const edges = vertices.map((start, index) => jointedEdge(start, vertices[(index + 1) % vertices.length], counts[index], depth, Array.isArray(phase) ? phase[index] : phase, matingOffsets[index] ?? 0));
  return { closed: true, points: edges.flatMap((edge, index) => index === 0 ? edge : edge.slice(1)) };
}

export function fingerJointOutline(width: number, height: number, counts: { top: number; right: number; bottom: number; left: number }, depth: number, phase: 0 | 1, offsets: { top: number; right: number; bottom: number; left: number } = { top: 0, right: 0, bottom: 0, left: 0 }): PolylinePath {
  return fingerJointPolygon([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], [counts.top, counts.right, counts.bottom, counts.left], depth, phase, [offsets.top, offsets.right, offsets.bottom, offsets.left]);
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c), abD = orientation(a, b, d);
  const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  const onSegment = (p: Point, q: Point, r: Point) => Math.abs(orientation(p, q, r)) < 1e-9
    && r.x >= Math.min(p.x, q.x) - 1e-9 && r.x <= Math.max(p.x, q.x) + 1e-9
    && r.y >= Math.min(p.y, q.y) - 1e-9 && r.y <= Math.max(p.y, q.y) + 1e-9;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function hasSelfIntersection(path: PolylinePath): boolean {
  const points = path.points.length > 1 && path.points[0].x === path.points.at(-1)?.x && path.points[0].y === path.points.at(-1)?.y
    ? path.points.slice(0, -1) : path.points;
  const segmentCount = path.closed ? points.length : points.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    for (let j = i + 1; j < segmentCount; j++) {
      if (j === i + 1 || (i === 0 && j === segmentCount - 1)) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      if (intersects(a, b, c, d)) return true;
    }
  }
  return false;
}
