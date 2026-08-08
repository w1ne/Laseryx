import type { MacroDef, MacroDefSummary, MacroParamValue } from "./types";
import { circleToPolyline, rectPolyline, roundedRectToPolyline } from "./geomHelpers";
import { bool, num, str, validateParams } from "./validateParams";

export const CATALOG_VERSION = 1;

/** @deprecated kept for tests that import the name; presets no longer used for cutout. */
export const SCREEN_PRESETS: Record<string, Record<string, MacroParamValue>> = {};

const numParam = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number
) => ({
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

/** One Hole — set diameter after place. */
const mountHole: MacroDef = {
  id: "mount-hole",
  defVersion: 2,
  name: "Hole",
  category: "mount",
  params: [numParam("diameterMm", "Diameter", 3, 0.5, 200)],
  expand: (params) => {
    const d = num(params, "diameterMm", 3);
    return [circleToPolyline(0, 0, Math.max(0.25, d / 2))];
  }
};

/** One Frame — set width / height. */
const panel: MacroDef = {
  id: "panel",
  defVersion: 2,
  name: "Frame",
  category: "panel",
  params: [
    numParam("widthMm", "Width", 100, 1, 2000),
    numParam("heightMm", "Height", 80, 1, 2000)
  ],
  expand: (params) => {
    const w = num(params, "widthMm", 100);
    const h = num(params, "heightMm", 80);
    return [rectPolyline(0, 0, w, h)];
  }
};

/** One Cutout — rectangle opening; set width / height. */
const screen: MacroDef = {
  id: "screen",
  defVersion: 2,
  name: "Cutout",
  category: "display",
  params: [
    numParam("widthMm", "Width", 40, 1, 2000),
    numParam("heightMm", "Height", 30, 1, 2000)
  ],
  expand: (params) => {
    const w = num(params, "widthMm", 40);
    const h = num(params, "heightMm", 30);
    return [rectPolyline(0, 0, w, h)];
  }
};

const DEFS: MacroDef[] = [mountHole, panel, screen];

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

// keep imports used if roundedRect unused now
void roundedRectToPolyline;
void bool;
void str;
