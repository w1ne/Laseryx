import type { Obj } from "../../../core/model";
import { expandMacro } from "../../../core/macros/expand";
import { computeBounds } from "../../../core/geom";

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function objectBounds(obj: Obj): BBox | null {
  if (obj.kind === "image") {
    return {
      minX: obj.transform.e,
      minY: obj.transform.f,
      maxX: obj.transform.e + obj.width,
      maxY: obj.transform.f + obj.height
    };
  }
  if (obj.kind === "shape" && obj.shape.type === "rect") {
    const { e, f } = obj.transform;
    return {
      minX: e,
      minY: f,
      maxX: e + obj.shape.width,
      maxY: f + obj.shape.height
    };
  }
  if (obj.kind === "path") {
    const t = obj.transform;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of obj.points) {
      const x = p.x * t.a + p.y * t.c + t.e;
      const y = p.x * t.b + p.y * t.d + t.f;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }
  if (obj.kind === "macro") {
    const expanded = expandMacro(obj);
    if (!expanded.ok || expanded.paths.length === 0) {
      return {
        minX: obj.transform.e,
        minY: obj.transform.f,
        maxX: obj.transform.e + 40,
        maxY: obj.transform.f + 30
      };
    }
    return computeBounds(expanded.paths);
  }
  return null;
}

export function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}
