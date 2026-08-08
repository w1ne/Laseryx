import type { MacroDef, MacroDefSummary, MacroParamValue } from "./types";
import { circleToPolyline, cutDiameter, rectPolyline, roundedRectToPolyline } from "./geomHelpers";
import { bool, num, str, validateParams } from "./validateParams";

export const CATALOG_VERSION = 1;

/** Optional size presets for display openings (edit freely after place). */
export const SCREEN_PRESETS: Record<string, Record<string, MacroParamValue>> = {
  "2.8-ili9341": {
    widthMm: 50,
    heightMm: 69.2,
    holeDiameterMm: 2.5,
    holeInsetMm: 2.5
  }
};

function defaultClearance() {
  return {
    key: "clearanceMm",
    label: "Clearance",
    type: "number" as const,
    unit: "mm" as const,
    min: 0,
    max: 5,
    step: 0.05,
    default: 0.2,
    breaksPreset: true
  };
}

const mountHole: MacroDef = {
  id: "mount-hole",
  defVersion: 1,
  name: "Hole",
  category: "mount",
  params: [
    {
      key: "diameterMm",
      label: "Diameter",
      type: "number",
      unit: "mm",
      min: 0.5,
      max: 50,
      step: 0.1,
      default: 3,
      breaksPreset: true
    },
    defaultClearance()
  ],
  expand: (params) => {
    const d = cutDiameter(num(params, "diameterMm", 3), num(params, "clearanceMm", 0.2));
    return [circleToPolyline(0, 0, d / 2)];
  }
};

const button: MacroDef = {
  id: "button",
  defVersion: 1,
  name: "Circle",
  category: "control",
  params: [
    {
      key: "diameterMm",
      label: "Diameter",
      type: "number",
      unit: "mm",
      min: 1,
      max: 40,
      step: 0.1,
      default: 16,
      breaksPreset: true
    },
    defaultClearance()
  ],
  expand: (params) => {
    const d = cutDiameter(num(params, "diameterMm", 16), num(params, "clearanceMm", 0.2));
    return [circleToPolyline(0, 0, d / 2)];
  }
};

const screen: MacroDef = {
  id: "screen",
  defVersion: 1,
  name: "Cutout + holes",
  category: "display",
  params: [
    {
      key: "preset",
      label: "Preset",
      type: "enum",
      default: "custom",
      options: [
        { value: "custom", label: "Custom" },
        { value: "2.8-ili9341", label: '2.8" display' }
      ]
    },
    {
      key: "widthMm",
      label: "Opening W",
      type: "number",
      unit: "mm",
      min: 5,
      max: 400,
      step: 0.1,
      default: 50,
      breaksPreset: true
    },
    {
      key: "heightMm",
      label: "Opening H",
      type: "number",
      unit: "mm",
      min: 5,
      max: 400,
      step: 0.1,
      default: 69.2,
      breaksPreset: true
    },
    {
      key: "holeDiameterMm",
      label: "Hole nominal Ø",
      type: "number",
      unit: "mm",
      min: 0.5,
      max: 10,
      step: 0.1,
      default: 2.5,
      breaksPreset: true
    },
    {
      key: "holeInsetMm",
      label: "Hole inset",
      type: "number",
      unit: "mm",
      min: 0,
      max: 50,
      step: 0.1,
      default: 2.5,
      breaksPreset: true
    },
    defaultClearance()
  ],
  expand: (params) => {
    const w = num(params, "widthMm", 50);
    const h = num(params, "heightMm", 69.2);
    const inset = num(params, "holeInsetMm", 2.5);
    const holeD = cutDiameter(num(params, "holeDiameterMm", 2.5), num(params, "clearanceMm", 0.2));
    const r = holeD / 2;
    const paths = [rectPolyline(0, 0, w, h)];
    // Holes first in array (prefer cut order)
    const holes = [
      circleToPolyline(inset, inset, r),
      circleToPolyline(w - inset, inset, r),
      circleToPolyline(inset, h - inset, r),
      circleToPolyline(w - inset, h - inset, r)
    ];
    return [...holes, ...paths];
  }
};

const panel: MacroDef = {
  id: "panel",
  defVersion: 1,
  name: "Frame",
  category: "panel",
  params: [
    {
      key: "widthMm",
      label: "Width",
      type: "number",
      unit: "mm",
      min: 10,
      max: 1000,
      step: 0.1,
      default: 160,
      breaksPreset: true
    },
    {
      key: "heightMm",
      label: "Height",
      type: "number",
      unit: "mm",
      min: 10,
      max: 1000,
      step: 0.1,
      default: 120,
      breaksPreset: true
    },
    {
      key: "cornerRadiusMm",
      label: "Corner radius",
      type: "number",
      unit: "mm",
      min: 0,
      max: 50,
      step: 0.1,
      default: 0,
      breaksPreset: true
    },
    {
      key: "includeCornerHoles",
      label: "Corner holes",
      type: "boolean",
      default: true
    },
    {
      key: "holeDiameterMm",
      label: "Hole nominal Ø",
      type: "number",
      unit: "mm",
      min: 0.5,
      max: 20,
      step: 0.1,
      default: 3,
      breaksPreset: true
    },
    {
      key: "holeInsetMm",
      label: "Hole inset",
      type: "number",
      unit: "mm",
      min: 0,
      max: 50,
      step: 0.1,
      default: 5,
      breaksPreset: true
    },
    defaultClearance()
  ],
  expand: (params) => {
    const w = num(params, "widthMm", 160);
    const h = num(params, "heightMm", 120);
    const cr = num(params, "cornerRadiusMm", 0);
    const outer = cr > 0 ? roundedRectToPolyline(0, 0, w, h, cr) : rectPolyline(0, 0, w, h);
    if (!bool(params, "includeCornerHoles", true)) {
      return [outer];
    }
    const inset = num(params, "holeInsetMm", 5);
    const holeD = cutDiameter(num(params, "holeDiameterMm", 3), num(params, "clearanceMm", 0.2));
    const r = holeD / 2;
    return [
      circleToPolyline(inset, inset, r),
      circleToPolyline(w - inset, inset, r),
      circleToPolyline(inset, h - inset, r),
      circleToPolyline(w - inset, h - inset, r),
      outer
    ];
  }
};

const DEFS: MacroDef[] = [panel, screen, mountHole, button];

const BY_ID = new Map(DEFS.map((d) => [d.id, d]));

export function getMacroDef(defId: string): MacroDef | undefined {
  return BY_ID.get(defId);
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
  const base = validateParams(def, {});
  const preset = str(base, "preset", "custom");
  if (preset && preset !== "custom" && SCREEN_PRESETS[preset]) {
    return validateParams(def, { ...base, ...SCREEN_PRESETS[preset], preset });
  }
  return base;
}

export function v1DefIds(): string[] {
  return DEFS.map((d) => d.id);
}
