import type { MacroDef, MacroDefSummary, MacroParamValue } from "./types";
import { circleToPolyline } from "./geomHelpers";
import { num, validateParams } from "./validateParams";

export const CATALOG_VERSION = 1;

/** @deprecated unused — kept so older imports do not break */
export const SCREEN_PRESETS: Record<string, Record<string, MacroParamValue>> = {};

/**
 * Sketch primitives as macros:
 * - Circle only (rectangle is the built-in shape kind)
 * Frame/cutout removed — they were just rectangles.
 */
const circle: MacroDef = {
  id: "mount-hole",
  defVersion: 3,
  name: "Circle",
  category: "mount",
  params: [
    {
      key: "diameterMm",
      label: "Diameter",
      type: "number",
      unit: "mm",
      min: 0.5,
      max: 2000,
      step: 0.1,
      default: 10,
      breaksPreset: true
    }
  ],
  expand: (params) => {
    const d = num(params, "diameterMm", 10);
    return [circleToPolyline(0, 0, Math.max(0.25, d / 2))];
  }
};

const DEFS: MacroDef[] = [circle];

/** Old projects / commands map to Circle. */
const LEGACY_ALIASES: Record<string, string> = {
  button: "mount-hole",
  // frame & cutout no longer exist as macros — leave unresolved so old docs show missing-def UI
};

const BY_ID = new Map(DEFS.map((d) => [d.id, d]));

export function getMacroDef(defId: string): MacroDef | undefined {
  const resolved = LEGACY_ALIASES[defId] ?? defId;
  return BY_ID.get(resolved);
}

export function listMacroDefs(): MacroDefSummary[] {
  return DEFS.map(({ id, name, category, defVersion, approxNote, params }) => ({
    id,
    name,
    category,
    defVersion,
    approxNote,
    params
  }));
}

export function defaultParamsForDef(def: MacroDef): Record<string, MacroParamValue> {
  return validateParams(def, {});
}

export function v1DefIds(): string[] {
  return DEFS.map((d) => d.id);
}
