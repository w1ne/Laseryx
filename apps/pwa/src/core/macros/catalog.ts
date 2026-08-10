import type { MacroDef, MacroDefSummary, MacroParamValue } from "./types";
import { circleToPolyline, roundedRectToPolyline, slotToPolyline } from "./geomHelpers";
import { num, validateParams } from "./validateParams";

export const CATALOG_VERSION = 1;

/** @deprecated unused — kept so older imports do not break */
export const SCREEN_PRESETS: Record<string, Record<string, MacroParamValue>> = {};

const mm = (key: string, label: string, def: number, min: number, max: number) => ({
  key,
  label,
  type: "number" as const,
  unit: "mm" as const,
  min,
  max,
  step: 0.1,
  default: def,
  breaksPreset: true
});

/** Circle / hole — set diameter after place. */
const circle: MacroDef = {
  id: "mount-hole",
  defVersion: 3,
  name: "Circle",
  category: "mount",
  params: [mm("diameterMm", "Diameter", 10, 0.5, 2000)],
  expand: (params) => {
    const d = num(params, "diameterMm", 10);
    return [circleToPolyline(0, 0, Math.max(0.25, d / 2))];
  }
};

/** Slot (stadium) — set length & width after place. Use Mirror / Rot 90 for orientation. */
const slot: MacroDef = {
  id: "slot",
  defVersion: 1,
  name: "Slot",
  category: "mount",
  params: [
    mm("lengthMm", "Length", 30, 1, 2000),
    mm("widthMm", "Width", 6, 0.5, 500)
  ],
  expand: (params) => {
    const L = num(params, "lengthMm", 30);
    const w = num(params, "widthMm", 6);
    return [slotToPolyline(L, w)];
  }
};

/** Rounded rectangle — set W, H, corner radius. */
const roundRect: MacroDef = {
  id: "round-rect",
  defVersion: 1,
  name: "Round rect",
  category: "mount",
  params: [
    mm("widthMm", "Width", 40, 1, 2000),
    mm("heightMm", "Height", 25, 1, 2000),
    mm("radiusMm", "Corner R", 4, 0, 500)
  ],
  expand: (params) => {
    const w = num(params, "widthMm", 40);
    const h = num(params, "heightMm", 25);
    const rad = num(params, "radiusMm", 4);
    return [roundedRectToPolyline(0, 0, w, h, rad)];
  }
};

const DEFS: MacroDef[] = [circle, slot, roundRect];

const LEGACY_ALIASES: Record<string, string> = {
  button: "mount-hole"
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
