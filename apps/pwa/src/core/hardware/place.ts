import type { Point, PolylinePath } from "../model";
import { expandComponent } from "../components/expand";
import { getExampleComponentPresetBySku } from "../components/examples";
import { createComponentInstance, type ComponentPreset } from "../components/types";
import { getHardwareModule } from "./catalog";

export type PlacedHardware = {
  id: string;
  sku: string;
  name: string;
  origin: Point;
  parameters: Record<string, number>;
  paths: PolylinePath[];
};

export function placeHardwareModule(sku: string, origin: Point, overrides: Record<string, number> = {}, id = `${sku}-${Date.now()}`):
  | { ok: true; part: PlacedHardware }
  | { ok: false; code: "UNKNOWN_SKU" | "MEASURE_REQUIRED" | "INTERNAL_ONLY"; message: string } {
  const module = getHardwareModule(sku);
  if (!module) return { ok: false, code: "UNKNOWN_SKU", message: `Unknown hardware SKU ${sku}` };
  if (module.mounting === "internal") return { ok: false, code: "INTERNAL_ONLY", message: `${module.name} is internal-only by default.` };
  const parameters = { ...module.dimensions, ...overrides };
  if (module.geometry === "button-row" && module.requiresMeasurement && !(parameters.buttonDiameter > 0 && parameters.buttonPitch > 0)) {
    return { ok: false, code: "MEASURE_REQUIRED", message: `${module.name}: enter button diameter and pitch measured with calipers.` };
  }
  const example = getExampleComponentPresetBySku(sku);
  let preset: ComponentPreset;
  if (module.geometry === "button-row") {
    preset = { id: `legacy-${sku}`, name: module.name, kind: "button-row", dimensions: {
      count: 4, diameter: parameters.buttonDiameter, pitch: parameters.buttonPitch
    } };
  } else if (example?.kind === "circle") {
    preset = { ...example, dimensions: { diameter: parameters.cutoutDiameter } };
  } else if (example?.kind === "slot") {
    preset = { ...example, dimensions: { length: parameters.travel, width: parameters.slotWidth } };
  } else if (example?.kind === "rectangle") {
    preset = { ...example, dimensions: { width: parameters.cutoutWidth, height: parameters.cutoutHeight } };
  } else {
    return { ok: false, code: "UNKNOWN_SKU", message: `No cutout preset for hardware SKU ${sku}` };
  }
  const paths = expandComponent(createComponentInstance(preset, id));
  return { ok: true, part: { id, sku, name: module.name, origin, parameters, paths } };
}
