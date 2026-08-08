import type { Obj } from "../../../core/model";
import { boundsOf, type BBox } from "../../../core/objectEdit";

export type { BBox };

export function objectBounds(obj: Obj): BBox | null {
  return boundsOf(obj);
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
