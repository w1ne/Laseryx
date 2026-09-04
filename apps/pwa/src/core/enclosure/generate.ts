import type { PolylinePath, Transform } from "../model";
import type { EnclosureInput, EnclosurePanel, GeneratedEnclosure } from "./types";

const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
function fingerEdge(
  start: { x: number; y: number }, end: { x: number; y: number },
  outward: { x: number; y: number }, count: number, depth: number, phase: 0 | 1
) {
  const points = [{ ...start }];
  for (let i = 0; i < count; i++) {
    const active = (i + phase) % 2 === 0;
    const x1 = start.x + (end.x - start.x) * i / count;
    const y1 = start.y + (end.y - start.y) * i / count;
    const x2 = start.x + (end.x - start.x) * (i + 1) / count;
    const y2 = start.y + (end.y - start.y) * (i + 1) / count;
    if (active) points.push({ x: x1 + outward.x * depth, y: y1 + outward.y * depth }, { x: x2 + outward.x * depth, y: y2 + outward.y * depth });
    points.push({ x: x2, y: y2 });
  }
  return points;
}

function fingerOutline(width: number, height: number, target: number, depth: number, phase: 0 | 1): PolylinePath {
  const horizontal = chooseOddFingerCount(width, target);
  const vertical = chooseOddFingerCount(height, target);
  const edges = [
    fingerEdge({ x: 0, y: 0 }, { x: width, y: 0 }, { x: 0, y: -1 }, horizontal, depth, phase),
    fingerEdge({ x: width, y: 0 }, { x: width, y: height }, { x: 1, y: 0 }, vertical, depth, phase),
    fingerEdge({ x: width, y: height }, { x: 0, y: height }, { x: 0, y: 1 }, horizontal, depth, phase),
    fingerEdge({ x: 0, y: height }, { x: 0, y: 0 }, { x: -1, y: 0 }, vertical, depth, phase)
  ];
  return { closed: true, points: edges.flatMap((edge, index) => index ? edge.slice(1) : edge) };
}

export function chooseOddFingerCount(length: number, targetWidth: number): number {
  const approximate = Math.max(3, Math.round(length / Math.max(targetWidth, 0.1)));
  return approximate % 2 === 1 ? approximate : approximate + 1;
}

export function generateEnclosure(input: EnclosureInput): GeneratedEnclosure {
  for (const [key, value] of Object.entries(input)) if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be greater than zero`);
  const slopedLength = Math.hypot(input.depth, input.rearHeight - input.frontHeight);
  const specs: Array<[EnclosurePanel["id"], string, number, number, boolean?]> = [
    ["front", "Front control panel", input.width, slopedLength],
    ["rear", "Rear panel", input.width, input.rearHeight],
    ["left", "Left side", input.depth, input.rearHeight],
    ["right", "Right side", input.depth, input.rearHeight],
    ["base", "Base", input.width, input.depth],
    ["service-lid", "Service lid", input.width - 2 * input.thickness, input.depth - 2 * input.thickness, true]
  ];
  return {
    input: { ...input },
    slopeDegrees: Math.atan2(input.rearHeight - input.frontHeight, input.depth) * 180 / Math.PI,
    panels: specs.map(([id, name, width, height, removable]) => {
      const phase: 0 | 1 = id === "left" || id === "right" || id === "service-lid" ? 1 : 0;
      const horizontal = chooseOddFingerCount(width, input.fingerTarget);
      const vertical = chooseOddFingerCount(height, input.fingerTarget);
      return { id, name, width, height, removable, transform: { ...identity }, paths: [fingerOutline(width, height, input.fingerTarget, input.thickness + input.clearance / 2, phase)], fingerCount: horizontal, edgePattern: { horizontal, vertical, phase } };
    })
  };
}
