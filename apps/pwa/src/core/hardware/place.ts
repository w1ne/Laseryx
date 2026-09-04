import type { Point, PolylinePath } from "../model";
import { getHardwareModule } from "./catalog";

export type PlacedHardware = {
  id: string;
  sku: string;
  name: string;
  origin: Point;
  parameters: Record<string, number>;
  paths: PolylinePath[];
};

const rectangle = (w: number, h: number): PolylinePath => ({ closed: true, points: [
  { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
  { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
] });

const circle = (diameter: number): PolylinePath => ({ closed: true, points: Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * Math.PI * 2;
  return { x: Math.cos(angle) * diameter / 2, y: Math.sin(angle) * diameter / 2 };
}) });

export function placeHardwareModule(sku: string, origin: Point, overrides: Record<string, number> = {}, id = `${sku}-${Date.now()}`):
  | { ok: true; part: PlacedHardware }
  | { ok: false; code: "UNKNOWN_SKU" | "MEASURE_REQUIRED" | "INTERNAL_ONLY"; message: string } {
  const module = getHardwareModule(sku);
  if (!module) return { ok: false, code: "UNKNOWN_SKU", message: `Unknown hardware SKU ${sku}` };
  if (module.mounting === "internal") return { ok: false, code: "INTERNAL_ONLY", message: `${module.name} is internal-only by default.` };
  const parameters = { ...module.dimensions, ...overrides };
  if (module.requiresMeasurement && !(parameters.buttonDiameter > 0 && parameters.buttonPitch > 0)) {
    return { ok: false, code: "MEASURE_REQUIRED", message: `${module.name}: enter button diameter and pitch measured with calipers.` };
  }
  let paths: PolylinePath[];
  if (module.geometry === "display") paths = [rectangle(parameters.cutoutWidth, parameters.cutoutHeight)];
  else if (module.geometry === "round") paths = [circle(parameters.cutoutDiameter)];
  else if (module.geometry === "slot") paths = [rectangle(parameters.travel, parameters.slotWidth)];
  else paths = Array.from({ length: 4 }, (_, i) => ({ ...circle(parameters.buttonDiameter), points: circle(parameters.buttonDiameter).points.map((p) => ({ ...p, x: p.x + (i - 1.5) * parameters.buttonPitch })) }));
  return { ok: true, part: { id, sku, name: module.name, origin, parameters, paths } };
}
