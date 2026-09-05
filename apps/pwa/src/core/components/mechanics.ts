import type { ComponentMechanics, ComponentPreset } from "./types";

const positive = (value: number) => Number.isFinite(value) && value > 0;
const validHole = (hole: { x: number; y: number; diameter: number }, label: string): string[] => {
  const issues: string[] = [];
  if (!Number.isFinite(hole.x) || !Number.isFinite(hole.y)) issues.push(`${label} position must be finite.`);
  if (!positive(hole.diameter)) issues.push(`${label} diameter must be positive.`);
  return issues;
};

export function validateMechanics(mechanics?: ComponentMechanics): string[] {
  if (!mechanics) return [];
  const issues: string[] = [];
  if (mechanics.body) {
    if (!positive(mechanics.body.width)) issues.push("Body width must be positive.");
    if (!positive(mechanics.body.height)) issues.push("Body height must be positive.");
    if (mechanics.body.depth !== undefined && !positive(mechanics.body.depth)) issues.push("Body depth must be positive.");
  }
  mechanics.mountingHoles?.forEach((hole) => issues.push(...validHole(hole, "Mounting hole")));
  if (mechanics.acousticHole) issues.push(...validHole(mechanics.acousticHole, "Acoustic hole"));
  if (mechanics.frontProtrusion !== undefined && (!Number.isFinite(mechanics.frontProtrusion) || mechanics.frontProtrusion < 0)) issues.push("Front protrusion must be zero or positive.");
  if (mechanics.missing?.some((item) => !item.trim())) issues.push("Missing-measurement labels must not be empty.");
  return issues;
}

export function componentReadiness(component: Pick<ComponentPreset, "mechanics">) {
  const missing = component.mechanics?.missing?.filter((item) => item.trim()) ?? [];
  return { ready: missing.length === 0 && validateMechanics(component.mechanics).length === 0, missing, warnings: component.mechanics?.warnings ?? [] };
}
