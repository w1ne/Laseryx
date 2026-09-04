import type { PackedSheet, PackPart, Placement, SheetSettings } from "./types";

export function packParts(source: readonly PackPart[], settings: SheetSettings): { sheets: PackedSheet[]; overflow: PackPart[] } {
  const parts = [...source].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || a.id.localeCompare(b.id));
  const sheets: PackedSheet[] = [];
  const overflow: PackPart[] = [];
  for (const part of parts) {
    const orientations = [{ width: part.width, height: part.height, rotated: false }, ...(settings.allowRotation ? [{ width: part.height, height: part.width, rotated: true }] : [])];
    if (!orientations.some((o) => o.width <= settings.width - 2 * settings.margin && o.height <= settings.height - 2 * settings.margin)) { overflow.push({ ...part }); continue; }
    let placed = false;
    for (const sheet of sheets) {
      for (const orientation of orientations) {
        const candidates = [{ x: settings.margin, y: settings.margin }, ...sheet.placements.flatMap((p) => [{ x: p.x + p.width + settings.gap, y: p.y }, { x: p.x, y: p.y + p.height + settings.gap }])];
        const spot = candidates.find((c) => c.x + orientation.width <= settings.width - settings.margin && c.y + orientation.height <= settings.height - settings.margin && sheet.placements.every((p) => c.x + orientation.width + settings.gap <= p.x || p.x + p.width + settings.gap <= c.x || c.y + orientation.height + settings.gap <= p.y || p.y + p.height + settings.gap <= c.y));
        if (spot) { sheet.placements.push({ id: part.id, ...orientation, ...spot } as Placement); placed = true; break; }
      }
      if (placed) break;
    }
    if (!placed) {
      const orientation = orientations.find((o) => o.width <= settings.width - 2 * settings.margin && o.height <= settings.height - 2 * settings.margin)!;
      sheets.push({ id: `sheet-${sheets.length + 1}`, width: settings.width, height: settings.height, placements: [{ id: part.id, ...orientation, x: settings.margin, y: settings.margin }] });
    }
  }
  return { sheets, overflow };
}
