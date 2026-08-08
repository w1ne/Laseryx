import type { MacroDef, MacroParamValue } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function coerceValue(
  spec: MacroDef["params"][number],
  raw: unknown
): MacroParamValue {
  if (raw === undefined || raw === null) {
    return spec.default;
  }

  switch (spec.type) {
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === 1 || raw === "1") return true;
      if (raw === "false" || raw === 0 || raw === "0") return false;
      return Boolean(raw);
    case "enum":
    case "string":
      return String(raw);
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return spec.default as number;
      let v = n;
      if (spec.min !== undefined) v = Math.max(spec.min, v);
      if (spec.max !== undefined) v = Math.min(spec.max, v);
      return v;
    }
    default:
      return spec.default;
  }
}

/** Fill defaults and clamp/coerce against schema. */
export function validateParams(
  def: MacroDef,
  partial: Record<string, unknown> = {}
): Record<string, MacroParamValue> {
  const out: Record<string, MacroParamValue> = {};
  for (const spec of def.params) {
    out[spec.key] = coerceValue(spec, partial[spec.key]);
  }
  return out;
}

/**
 * Merge partial params onto previous, apply preset table rules:
 * - Selecting a non-custom preset overwrites dimension fields from presetTable.
 * - Editing any breaksPreset field sets preset to "custom".
 */
export function applyMacroParamUpdate(
  def: MacroDef,
  previous: Record<string, MacroParamValue>,
  partial: Record<string, unknown>,
  presetTable?: Record<string, Record<string, MacroParamValue>>
): Record<string, MacroParamValue> {
  const merged: Record<string, unknown> = { ...previous, ...partial };
  const hasPreset = def.params.some((p) => p.key === "preset");

  if (hasPreset && typeof partial.preset === "string" && partial.preset !== "custom") {
    const table = presetTable?.[partial.preset];
    if (table) {
      for (const [key, value] of Object.entries(table)) {
        merged[key] = value;
      }
      merged.preset = partial.preset;
    }
  } else if (hasPreset) {
    const broke = def.params.some(
      (spec) => spec.breaksPreset && Object.prototype.hasOwnProperty.call(partial, spec.key)
    );
    if (broke) {
      merged.preset = "custom";
    }
  }

  return validateParams(def, merged);
}

export function num(params: Record<string, MacroParamValue>, key: string, fallback = 0): number {
  const v = params[key];
  return isFiniteNumber(v) ? v : fallback;
}

export function bool(params: Record<string, MacroParamValue>, key: string, fallback = false): boolean {
  const v = params[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(params: Record<string, MacroParamValue>, key: string, fallback = ""): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}
