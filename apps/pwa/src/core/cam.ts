import type {
  CamPlan,
  CamSettings,
  Document,
  Obj,
  Operation,
  PlannedOp,
  PolylinePath,
  PreviewGeom
} from "./model";
import { computeBounds, polygonArea, rectToPolyline, transformPoints } from "./geom";

export type CamPlanResult = {
  plan: CamPlan;
  preview: PreviewGeom;
  warnings: string[];
};

import { generateRasterToolpath } from "./raster";

type IndexedPath = {
  path: PolylinePath;
  index: number;
};

export function planCam(document: Document, cam: CamSettings, images?: Map<string, ImageData>): CamPlanResult {
  const warnings: string[] = [];
  const layerMap = new Map(document.layers.map((layer) => [layer.id, layer]));
  const ops: PlannedOp[] = [];

  if (cam.operations.length === 0) {
    warnings.push("No operations configured.");
  }

  const layersWithObjects = new Set(document.objects.map((obj) => obj.layerId));
  for (const layer of document.layers) {
    if (layersWithObjects.has(layer.id) && !layer.operationId) {
      warnings.push(`Layer "${layer.name}" has no operation assigned.`);
    } else if (layer.operationId && !cam.operations.some((op) => op.id === layer.operationId)) {
      warnings.push(`Layer "${layer.name}" references a missing operation.`);
    }
  }

  for (const operation of cam.operations) {
    const layerIds = document.layers
      .filter((layer) => layer.visible && layer.operationId === operation.id)
      .map((layer) => layer.id);

    const paths: PolylinePath[] = [];
    for (const obj of document.objects) {
      if (!layerIds.includes(obj.layerId)) {
        continue;
      }
      const layer = layerMap.get(obj.layerId);
      if (!layer || !layer.visible) {
        continue;
      }

      if (operation.type === "rasterEngrave") {
        if (obj.kind === "image") {
          const imageData = images?.get(obj.id);
          if (imageData) {
            // BBox for image: transform.e/f + width/height (ignoring rotation for MVP)
            const bbox = {
              x: obj.transform.e,
              y: obj.transform.f,
              w: obj.width,
              h: obj.height // These are physical dimensions
            };
            // Avoid spread operator for large arrays (stack overflow)
            const rasterPaths = generateRasterToolpath(imageData, cam, operation, bbox);
            for (const path of rasterPaths) {
              paths.push(path);
            }
          } else {
            warnings.push(`Missing image data for object ${obj.id}`);
          }
        }
      } else {
        // Vector operations
        if (obj.kind === "image") {
          // Cannot cut/engrave vector on an image
          continue;
        }
        paths.push(...objToPolylines(obj));
      }
    }

    const ordered = orderPaths(paths, operation);
    ops.push({ opId: operation.id, kind: "vector", paths: ordered });
  }

  const previewPaths = ops.flatMap((op) => op.paths);
  const preview: PreviewGeom = {
    bbox: computeBounds(previewPaths),
    vector: previewPaths
  };

  return { plan: { ops }, preview, warnings };
}

function objToPolylines(obj: Obj): PolylinePath[] {
  switch (obj.kind) {
    case "path":
      return [
        {
          points: transformPoints(obj.points, obj.transform),
          closed: obj.closed
        }
      ];
    case "shape":
      if (obj.shape.type === "rect") {
        return [rectToPolyline(obj.shape, obj.transform)];
      }
      return [];
    default:
      return [];
  }
}

function orderPaths(paths: PolylinePath[], operation: Operation): PolylinePath[] {
  if (paths.length <= 1) {
    return paths;
  }

  switch (operation.order) {
    case "insideOut":
      return orderInsideOut(paths);
    case "shortestTravel":
      return orderShortestTravel(paths);
    default:
      return paths;
  }
}

function orderInsideOut(paths: PolylinePath[]): PolylinePath[] {
  const indexed = paths.map((path, index) => ({ path, index }));

  indexed.sort((a, b) => {
    const areaA = Math.abs(polygonArea(a.path.points));
    const areaB = Math.abs(polygonArea(b.path.points));
    if (areaA === areaB) {
      return a.index - b.index;
    }
    return areaA - areaB;
  });

  return indexed.map((entry) => entry.path);
}

function orderShortestTravel(paths: PolylinePath[]): PolylinePath[] {
  const remaining: IndexedPath[] = paths.map((path, index) => ({ path, index }));
  const ordered: PolylinePath[] = [];

  let current = remaining.shift();
  if (!current) {
    return [];
  }
  ordered.push(current.path);

  while (remaining.length > 0) {
    const currentEnd = getPathEnd(current.path);
    let bestIndex = 0;
    let bestDistance = distanceSquared(currentEnd, getPathStart(remaining[0].path));

    for (let i = 1; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const candidateDistance = distanceSquared(currentEnd, getPathStart(candidate.path));
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestIndex = i;
      } else if (candidateDistance === bestDistance) {
        if (candidate.index < remaining[bestIndex].index) {
          bestIndex = i;
        }
      }
    }

    current = remaining.splice(bestIndex, 1)[0];
    ordered.push(current.path);
  }

  return ordered;
}

function getPathStart(path: PolylinePath) {
  return path.points[0];
}

function getPathEnd(path: PolylinePath) {
  if (path.closed) {
    return path.points[0];
  }
  return path.points[path.points.length - 1];
}

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
