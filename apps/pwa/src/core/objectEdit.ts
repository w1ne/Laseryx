import type { Obj, Transform } from "./model";
import { expandMacro } from "./macros/expand";
import { computeBounds } from "./geom";
import { roundMm } from "./util";

const r = (n: number) => roundMm(n);

/** Round geometry patch fields to laser-friendly 0.1 mm. */
function roundPatch(patch: Partial<Obj>): Partial<Obj> {
  const out: Partial<Obj> = { ...patch };
  if (out.transform) {
    out.transform = {
      ...out.transform,
      e: r(out.transform.e),
      f: r(out.transform.f)
    };
  }
  if (out.shape && out.shape.type === "rect") {
    out.shape = {
      type: "rect",
      width: Math.max(0.1, r(out.shape.width)),
      height: Math.max(0.1, r(out.shape.height))
    };
  }
  if (typeof out.width === "number") out.width = Math.max(0.1, r(out.width));
  if (typeof out.height === "number") out.height = Math.max(0.1, r(out.height));
  if (out.params) {
    const p: Record<string, number | string | boolean> = { ...out.params };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "number") p[k] = r(v);
    }
    out.params = p;
  }
  return out;
}

export type Size2 = { w: number; h: number };

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function boundsOf(obj: Obj): BBox | null {
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
    return { minX: e, minY: f, maxX: e + obj.shape.width, maxY: f + obj.shape.height };
  }
  if (obj.kind === "path") {
    const t = obj.transform;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
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

export function getObjectSize(obj: Obj): Size2 | null {
  const b = boundsOf(obj);
  if (!b) return null;
  return { w: r(b.maxX - b.minX), h: r(b.maxY - b.minY) };
}

/** Set width/height in mm (keeps top-left of bbox fixed when possible). */
export function setObjectSize(obj: Obj, w: number, h: number): Partial<Obj> | null {
  w = r(w);
  h = r(h);
  if (!(w > 0) || !(h > 0)) return null;
  const b = boundsOf(obj);
  if (!b) return null;

  if (obj.kind === "shape" && obj.shape.type === "rect") {
    return roundPatch({
      transform: { ...obj.transform, e: b.minX, f: b.minY },
      shape: { type: "rect", width: w, height: h }
    });
  }
  if (obj.kind === "image") {
    return roundPatch({
      transform: { ...obj.transform, e: b.minX, f: b.minY },
      width: w,
      height: h
    });
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") {
      const d = Math.max(0.5, Math.min(w, h));
      return roundPatch({
        transform: {
          ...obj.transform,
          e: b.minX + d / 2,
          f: b.minY + d / 2
        },
        params: { ...obj.params, diameterMm: d }
      });
    }
  }
  if (obj.kind === "path") {
    const curW = b.maxX - b.minX || 1;
    const curH = b.maxY - b.minY || 1;
    const sx = w / curW;
    const sy = h / curH;
    const t = obj.transform;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    return roundPatch({
      transform: {
        a: t.a * sx,
        b: t.b * sy,
        c: t.c * sx,
        d: t.d * sy,
        e: cx - (cx - t.e) * sx,
        f: cy - (cy - t.f) * sy
      }
    });
  }
  return null;
}

/** Move top-left of bbox to (x,y). */
export function setObjectPosition(obj: Obj, x: number, y: number): Partial<Obj> | null {
  const b = boundsOf(obj);
  if (!b) return null;
  const dx = r(x) - b.minX;
  const dy = r(y) - b.minY;
  return roundPatch({
    transform: {
      ...obj.transform,
      e: obj.transform.e + dx,
      f: obj.transform.f + dy
    }
  });
}

export function nudgeObject(obj: Obj, dx: number, dy: number): Partial<Obj> {
  return roundPatch({
    transform: {
      ...obj.transform,
      e: obj.transform.e + dx,
      f: obj.transform.f + dy
    }
  });
}

/** Mirror left↔right about bbox center. */
export function mirrorHorizontal(obj: Obj): Partial<Obj> | null {
  const b = boundsOf(obj);
  if (!b) return null;
  const cx = (b.minX + b.maxX) / 2;

  if (obj.kind === "shape" && obj.shape.type === "rect") {
    const w = obj.shape.width;
    return roundPatch({
      transform: { ...obj.transform, e: 2 * cx - obj.transform.e - w }
    });
  }
  if (obj.kind === "image") {
    return roundPatch({
      transform: { ...obj.transform, e: 2 * cx - obj.transform.e - obj.width }
    });
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") {
      return roundPatch({ transform: { ...obj.transform, e: 2 * cx - obj.transform.e } });
    }
    const w = Number(obj.params.widthMm ?? b.maxX - b.minX);
    return roundPatch({
      transform: { ...obj.transform, e: 2 * cx - obj.transform.e - w }
    });
  }
  if (obj.kind === "path") {
    const t = obj.transform;
    return roundPatch({
      transform: {
        a: -t.a,
        b: t.b,
        c: -t.c,
        d: t.d,
        e: 2 * cx - t.e,
        f: t.f
      }
    });
  }
  return null;
}

/** Mirror top↔bottom about bbox center. */
export function mirrorVertical(obj: Obj): Partial<Obj> | null {
  const b = boundsOf(obj);
  if (!b) return null;
  const cy = (b.minY + b.maxY) / 2;

  if (obj.kind === "shape" && obj.shape.type === "rect") {
    const h = obj.shape.height;
    return roundPatch({
      transform: { ...obj.transform, f: 2 * cy - obj.transform.f - h }
    });
  }
  if (obj.kind === "image") {
    return roundPatch({
      transform: { ...obj.transform, f: 2 * cy - obj.transform.f - obj.height }
    });
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") {
      return roundPatch({ transform: { ...obj.transform, f: 2 * cy - obj.transform.f } });
    }
    const h = Number(obj.params.heightMm ?? b.maxY - b.minY);
    return roundPatch({
      transform: { ...obj.transform, f: 2 * cy - obj.transform.f - h }
    });
  }
  if (obj.kind === "path") {
    const t = obj.transform;
    return roundPatch({
      transform: {
        a: t.a,
        b: -t.b,
        c: t.c,
        d: -t.d,
        e: t.e,
        f: 2 * cy - t.f
      }
    });
  }
  return null;
}

/**
 * Rotate 90° around bbox center.
 * dir 1 = 90° clockwise (Y-down canvas), -1 = counter-clockwise.
 */
export function rotate90(obj: Obj, dir: 1 | -1 = 1): Partial<Obj> | null {
  const b = boundsOf(obj);
  if (!b) return null;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const newW = h;
  const newH = w;
  const newMinX = cx - newW / 2;
  const newMinY = cy - newH / 2;

  if (obj.kind === "shape" && obj.shape.type === "rect") {
    return roundPatch({
      transform: { ...obj.transform, e: newMinX, f: newMinY },
      shape: { type: "rect", width: newW, height: newH }
    });
  }
  if (obj.kind === "image") {
    return roundPatch({
      transform: { ...obj.transform, e: newMinX, f: newMinY },
      width: newW,
      height: newH
    });
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") {
      return roundPatch({ transform: { ...obj.transform, e: cx, f: cy } });
    }
  }
  if (obj.kind === "path") {
    const t = obj.transform;
    if (dir === 1) {
      return roundPatch({
        transform: {
          a: t.c,
          b: -t.a,
          c: t.d,
          d: -t.b,
          e: cx + (t.f - cy),
          f: cy - (t.e - cx)
        } satisfies Transform
      });
    }
    return roundPatch({
      transform: {
        a: -t.c,
        b: t.a,
        c: -t.d,
        d: t.b,
        e: cx - (t.f - cy),
        f: cy + (t.e - cx)
      }
    });
  }
  return null;
}

export function duplicateObject(obj: Obj, offsetMm = 10): Obj {
  const copy = structuredClone(obj);
  copy.id = `${obj.kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  copy.transform = {
    ...copy.transform,
    e: r(copy.transform.e + offsetMm),
    f: r(copy.transform.f + offsetMm)
  };
  return copy;
}
