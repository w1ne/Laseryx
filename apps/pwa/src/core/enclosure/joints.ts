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

function jointedEdge(start: Point, end: Point, count: number, depth: number, phase: 0 | 1): Point[] {
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const inward = { x: -dy / length, y: dx / length };
  const points: Point[] = [{ ...start }];
  for (let i = 0; i < count; i++) {
    const a = { x: start.x + dx * i / count, y: start.y + dy * i / count };
    const b = { x: start.x + dx * (i + 1) / count, y: start.y + dy * (i + 1) / count };
    if ((i + phase) % 2 === 0) points.push({ x: a.x + inward.x * depth, y: a.y + inward.y * depth }, { x: b.x + inward.x * depth, y: b.y + inward.y * depth });
    points.push(b);
  }
  return points;
}

export function fingerJointPolygon(vertices: Point[], counts: number[], depth: number, phase: 0 | 1 | Array<0 | 1>): PolylinePath {
  const edges = vertices.map((start, index) => jointedEdge(start, vertices[(index + 1) % vertices.length], counts[index], depth, Array.isArray(phase) ? phase[index] : phase));
  return { closed: true, points: edges.flatMap((edge, index) => index === 0 ? edge : edge.slice(1)) };
}

export function fingerJointOutline(width: number, height: number, counts: { top: number; right: number; bottom: number; left: number }, depth: number, phase: 0 | 1): PolylinePath {
  return fingerJointPolygon([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], [counts.top, counts.right, counts.bottom, counts.left], depth, phase);
}
