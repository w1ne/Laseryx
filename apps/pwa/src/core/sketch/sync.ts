import type { Document, Obj } from "../model";
import { bakeSketch, isSketchObjectId } from "./bake";
import { ensureOrigin } from "./create";
import { solveSketch } from "./solver";
import type { SketchDocument, SolveStatus } from "./types";

/**
 * Merge non-sketch objects with baked sketch geometry.
 * Sketch paths replace any previous sketch:* objects.
 */
export function mergeSketchIntoObjects(
  objects: Obj[],
  sketch: SketchDocument | null | undefined,
  defaultLayerId: string
): Obj[] {
  const nonSketch = objects.filter((o) => !isSketchObjectId(o.id));
  if (!sketch) return nonSketch;
  const baked = bakeSketch(sketch, defaultLayerId);
  return [...nonSketch, ...baked];
}

export type SyncResult = {
  document: Document;
  status: SolveStatus | null;
};

/**
 * Solve sketch (if present) and rewrite document.objects sketch:* entries.
 */
export function syncDocumentSketch(
  document: Document,
  opts?: { skipSolve?: boolean }
): SyncResult {
  const sketch = document.sketch;
  if (!sketch) {
    return {
      document: {
        ...document,
        objects: document.objects.filter((o) => !isSketchObjectId(o.id))
      },
      status: null
    };
  }

  // Always pin machine origin (0,0) so dims can measure to it
  let nextSketch = ensureOrigin(sketch);
  let status: SolveStatus | null = null;
  if (!opts?.skipSolve) {
    const solved = solveSketch(nextSketch);
    nextSketch = ensureOrigin(solved.sketch);
    status = solved.status;
  }

  const layerId = document.layers[0]?.id ?? "layer-1";
  const objects = mergeSketchIntoObjects(document.objects, nextSketch, layerId);

  return {
    document: {
      ...document,
      sketch: nextSketch,
      objects
    },
    status
  };
}
