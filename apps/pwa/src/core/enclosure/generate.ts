import type { PolylinePath, Transform } from "../model";
import type { EnclosureInput, EnclosurePanel, GeneratedEnclosure } from "./types";

const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const outline = (width: number, height: number): PolylinePath => ({ closed: true, points: [
  { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }
] });

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
    panels: specs.map(([id, name, width, height, removable]) => ({ id, name, width, height, removable, transform: { ...identity }, paths: [outline(width, height)], fingerCount: chooseOddFingerCount(width, input.fingerTarget) }))
  };
}
