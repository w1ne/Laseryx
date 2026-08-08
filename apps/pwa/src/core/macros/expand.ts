import type { MacroObj, PolylinePath, Transform } from "../model";
import { transformPoints } from "../geom";
import { getMacroDef } from "./catalog";
import { applyMacroParamUpdate, validateParams } from "./validateParams";
import { SCREEN_PRESETS } from "./catalog";

export type ExpandResult =
  | { ok: true; paths: PolylinePath[]; warning?: string }
  | { ok: false; paths: []; error: string };

function applyTransformToPaths(paths: PolylinePath[], transform: Transform): PolylinePath[] {
  return paths.map((path) => ({
    points: transformPoints(path.points, transform),
    closed: path.closed
  }));
}

export function expandMacro(obj: MacroObj): ExpandResult {
  const def = getMacroDef(obj.defId);
  if (!def) {
    return {
      ok: false,
      paths: [],
      error: `Unknown macro defId: ${obj.defId}`
    };
  }

  const params = validateParams(def, obj.params);
  try {
    const local = def.expand(params);
    const paths = applyTransformToPaths(local, obj.transform);
    const stale =
      obj.defVersion !== def.defVersion
        ? `Macro ${obj.defId} catalog version ${obj.defVersion} vs app ${def.defVersion} — verify dimensions.`
        : undefined;
    return { ok: true, paths, warning: stale };
  } catch (e) {
    return {
      ok: false,
      paths: [],
      error: e instanceof Error ? e.message : "Macro expand failed"
    };
  }
}

export function expandMacroPathsOrEmpty(obj: MacroObj): PolylinePath[] {
  const result = expandMacro(obj);
  return result.paths;
}

export function revalidateMacroParams(
  defId: string,
  previous: Record<string, number | string | boolean>,
  partial: Record<string, unknown>
): Record<string, number | string | boolean> | null {
  const def = getMacroDef(defId);
  if (!def) return null;
  const presetTable = defId === "screen" ? SCREEN_PRESETS : undefined;
  return applyMacroParamUpdate(def, previous, partial, presetTable);
}
