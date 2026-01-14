import type { Point, PolylinePath, RectShape, Transform } from "./model";

export const IDENTITY_TRANSFORM: Transform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
};

export function applyTransform(point: Point, transform: Transform): Point {
  return {
    x: point.x * transform.a + point.y * transform.c + transform.e,
    y: point.x * transform.b + point.y * transform.d + transform.f
  };
}

export function composeTransforms(t1: Transform, t2: Transform): Transform {
  return {
    a: t1.a * t2.a + t1.c * t2.b,
    b: t1.b * t2.a + t1.d * t2.b,
    c: t1.a * t2.c + t1.c * t2.d,
    d: t1.b * t2.c + t1.d * t2.d,
    e: t1.a * t2.e + t1.c * t2.f + t1.e,
    f: t1.b * t2.e + t1.d * t2.f + t1.f
  };
}

export function transformPoints(points: Point[], transform: Transform): Point[] {
  return points.map((point) => applyTransform(point, transform));
}

export function rectToPolyline(shape: RectShape, transform: Transform): PolylinePath {
  const base: Point[] = [
    { x: 0, y: 0 },
    { x: shape.width, y: 0 },
    { x: shape.width, y: shape.height },
    { x: 0, y: shape.height }
  ];

  return {
    points: transformPoints(base, transform),
    closed: true
  };
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function computeBounds(paths: PolylinePath[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (paths.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const path of paths) {
    for (const point of path.points) {
      if (point.x < minX) {
        minX = point.x;
      }
      if (point.y < minY) {
        minY = point.y;
      }
      if (point.x > maxX) {
        maxX = point.x;
      }
      if (point.y > maxY) {
        maxY = point.y;
      }
    }
  }

  if (minX === Number.POSITIVE_INFINITY) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const nextIndex = (i + 1) % points.length;
    const current = points[i];
    const next = points[nextIndex];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function pathLength(path: PolylinePath): number {
  if (path.points.length < 2) {
    return 0;
  }

  let length = 0;
  for (let i = 1; i < path.points.length; i += 1) {
    length += distance(path.points[i - 1], path.points[i]);
  }
  if (path.closed) {
    length += distance(path.points[path.points.length - 1], path.points[0]);
  }
  return length;
}
