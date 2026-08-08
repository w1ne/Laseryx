import type { Document, Transform } from "../model";

const BASE_E = 10;
const BASE_F = 10;
const STEP = 20;
const PER_ROW = 5;

/**
 * Cascade placement so new macros are not stacked on the same point.
 * Row layout: e = 10 + (n % 5) * 20, f = 10 + floor(n / 5) * 20.
 */
export function nextCascadeTransform(
  document: Document,
  bedMm?: { w: number; h: number }
): Transform {
  const n = document.objects.filter((o) => o.kind === "macro").length;
  let col = n % PER_ROW;
  let row = Math.floor(n / PER_ROW);

  let e = BASE_E + col * STEP;
  let f = BASE_F + row * STEP;

  if (bedMm) {
    while (e > bedMm.w - STEP && col > 0) {
      col = 0;
      row += 1;
      e = BASE_E;
      f = BASE_F + row * STEP;
    }
    if (f > bedMm.h - STEP) {
      f = BASE_F;
    }
  }

  return { a: 1, b: 0, c: 0, d: 1, e, f };
}
