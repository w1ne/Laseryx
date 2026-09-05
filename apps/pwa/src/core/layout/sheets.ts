import type { PathObj } from "../model";
import type { Sheet } from "./types";

export function expandSheetBoundaries(sheets: readonly Sheet[], layerId: string): PathObj[] {
  return sheets.map((sheet) => ({ kind: "path", id: `sheet-boundary:${sheet.id}`, layerId, closed: true, construction: true,
    name: `Sheet ${sheet.id}`, transform: { a: 1, b: 0, c: 0, d: 1, e: sheet.x, f: sheet.y },
    points: [{ x: 0, y: 0 }, { x: sheet.width, y: 0 }, { x: sheet.width, y: sheet.height }, { x: 0, y: sheet.height }] }));
}
