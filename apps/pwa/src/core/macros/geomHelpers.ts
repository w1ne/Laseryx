import type { Point, PolylinePath } from "../model";

export function circleSegmentCount(radiusMm: number): number {
  return Math.max(24, Math.ceil(Math.abs(radiusMm) * 4));
}

export function circleToPolyline(
  cx: number,
  cy: number,
  radiusMm: number,
  segments?: number
): PolylinePath {
  const r = Math.abs(radiusMm);
  const n = segments ?? circleSegmentCount(r);
  const points: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return { points, closed: true };
}

export function rectPolyline(x: number, y: number, width: number, height: number): PolylinePath {
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    ],
    closed: true
  };
}

export function roundedRectToPolyline(
  x: number,
  y: number,
  width: number,
  height: number,
  radiusMm: number,
  segmentsPerCorner = 6
): PolylinePath {
  const r = Math.max(0, Math.min(radiusMm, width / 2, height / 2));
  if (r <= 0) {
    return rectPolyline(x, y, width, height);
  }

  const points: Point[] = [];
  const corners: Array<{ cx: number; cy: number; start: number; end: number }> = [
    { cx: x + width - r, cy: y + r, start: -Math.PI / 2, end: 0 },
    { cx: x + width - r, cy: y + height - r, start: 0, end: Math.PI / 2 },
    { cx: x + r, cy: y + height - r, start: Math.PI / 2, end: Math.PI },
    { cx: x + r, cy: y + r, start: Math.PI, end: (3 * Math.PI) / 2 }
  ];

  for (const corner of corners) {
    for (let i = 0; i <= segmentsPerCorner; i += 1) {
      const t = i / segmentsPerCorner;
      const a = corner.start + (corner.end - corner.start) * t;
      points.push({ x: corner.cx + r * Math.cos(a), y: corner.cy + r * Math.sin(a) });
    }
  }

  return { points, closed: true };
}

export function cutDiameter(nominalMm: number, clearanceMm: number): number {
  return Math.max(0, nominalMm + clearanceMm);
}

/**
 * Horizontal slot (stadium / capsule): overall length × width.
 * Ends are semicircles; length must be ≥ width (else becomes a circle).
 * Origin at top-left of bounding box.
 */
export function slotToPolyline(lengthMm: number, widthMm: number, segmentsPerEnd = 12): PolylinePath {
  const w = Math.max(0.5, Math.abs(widthMm));
  const L = Math.max(w, Math.abs(lengthMm));
  const r = w / 2;
  const straight = L - w;
  const points: Point[] = [];

  // Right semicircle (center at x = r + straight, y = r)
  const cxR = r + straight;
  const cy = r;
  for (let i = 0; i <= segmentsPerEnd; i += 1) {
    const a = -Math.PI / 2 + (Math.PI * i) / segmentsPerEnd;
    points.push({ x: cxR + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  // Left semicircle (center at x = r, y = r)
  const cxL = r;
  for (let i = 0; i <= segmentsPerEnd; i += 1) {
    const a = Math.PI / 2 + (Math.PI * i) / segmentsPerEnd;
    points.push({ x: cxL + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }

  return { points, closed: true };
}
