import type { Obj } from "../../../core/model";
import { boundsOf, type BBox } from "../../../core/objectEdit";

export type { BBox };

export function objectBounds(obj: Obj): BBox | null {
  return boundsOf(obj);
}

/**
 * Coordinate system for geometry on the bed.
 * When a `.machine-world` group is present (Y-up / front-left origin), use its CTM
 * so pointer deltas match object space (fixes mirrored up/down drag).
 */
export function machineWorldElement(svg: SVGSVGElement): SVGGraphicsElement {
  const world =
    (svg.querySelector("[data-testid='machine-world']") as SVGGElement | null) ||
    (svg.querySelector("g.machine-world") as SVGGElement | null);
  return world ?? svg;
}

export function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const el = machineWorldElement(svg);
  const ctm = el.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

/** Machine-world (or SVG user) → screen client pixels (in-place dim overlays). */
export function svgToClientPoint(
  svg: SVGSVGElement,
  x: number,
  y: number
): { x: number; y: number } | null {
  const el = machineWorldElement(svg);
  const ctm = el.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const screen = pt.matrixTransform(ctm);
  return { x: screen.x, y: screen.y };
}
