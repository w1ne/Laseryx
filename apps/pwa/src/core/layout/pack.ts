import type { PackOptions, PartBounds, Placement, Sheet, SheetLayout } from "./types";

const A5 = { width: 210, height: 148 } as const;
const dimensions = (part: PartBounds, rotation: 0 | 90) => rotation === 90 ? { width: part.height, height: part.width } : { width: part.width, height: part.height };
function intersects(a: Placement, ap: PartBounds, b: Placement, bp: PartBounds, gap = 0) {
  const ad = dimensions(ap, a.rotation), bd = dimensions(bp, b.rotation);
  return !(a.x + ad.width + gap <= b.x || b.x + bd.width + gap <= a.x || a.y + ad.height + gap <= b.y || b.y + bd.height + gap <= a.y);
}
function orientedSize(options: PackOptions) {
  const requested = options.sheetSize ?? A5, orientation = options.orientation ?? "landscape";
  const short = Math.min(requested.width, requested.height), long = Math.max(requested.width, requested.height);
  return orientation === "landscape" ? { width: long, height: short } : { width: short, height: long };
}

export function packParts(source: readonly PartBounds[], options: PackOptions = {}): SheetLayout {
  const margin = options.margin ?? 5, gap = options.gap ?? 2, sheetSize = orientedSize(options), orientation = options.orientation ?? "landscape";
  if (![margin, gap, sheetSize.width, sheetSize.height].every(Number.isFinite)
    || margin < 0 || gap < 0 || sheetSize.width <= 0 || sheetSize.height <= 0) throw new Error("Invalid sheet settings");
  const ids = new Set<string>();
  for (const part of source) { if (ids.has(part.id)) throw new Error(`Duplicate part id: ${part.id}`); ids.add(part.id); }
  const parts = source.map((part) => ({ ...part })).sort((a, b) => a.id.localeCompare(b.id));
  const sheets: Sheet[] = [], placements: Placement[] = [], unplacedPartIds: string[] = [];
  const addSheet = () => { const i = sheets.length; const sheet = { id: `sheet-${i + 1}`, x: i * (sheetSize.width + gap), y: 0, ...sheetSize }; sheets.push(sheet); return sheet; };
  addSheet();
  for (const part of parts) {
    if (!(part.width > 0 && part.height > 0 && Number.isFinite(part.width) && Number.isFinite(part.height))) { unplacedPartIds.push(part.id); continue; }
    const rotations: readonly (0 | 90)[] = [0, 90];
    if (!rotations.some((r) => { const d = dimensions(part, r); return d.width <= sheetSize.width - 2 * margin && d.height <= sheetSize.height - 2 * margin; })) { unplacedPartIds.push(part.id); continue; }
    let chosen: Placement | undefined;
    for (const sheet of sheets) {
      const onSheet = placements.filter((p) => p.sheetId === sheet.id);
      const candidates = [{ x: margin, y: margin }, ...onSheet.flatMap((p) => { const d = dimensions(parts.find(({ id }) => id === p.partId)!, p.rotation); return [{ x: p.x + d.width + gap, y: p.y }, { x: p.x, y: p.y + d.height + gap }]; })].sort((a, b) => a.y - b.y || a.x - b.x);
      for (const rotation of rotations) {
        const d = dimensions(part, rotation);
        const spot = candidates.find(({ x, y }) => {
          if (x + d.width > sheet.width - margin || y + d.height > sheet.height - margin) return false;
          const candidate: Placement = { partId: part.id, sheetId: sheet.id, x, y, rotation };
          return onSheet.every((other) => !intersects(candidate, part, other, parts.find(({ id }) => id === other.partId)!, gap));
        });
        if (spot) { chosen = { partId: part.id, sheetId: sheet.id, ...spot, rotation }; break; }
      }
      if (chosen) break;
    }
    if (!chosen) {
      const sheet = addSheet();
      const rotation = rotations.find((r) => { const d = dimensions(part, r); return d.width <= sheet.width - 2 * margin && d.height <= sheet.height - 2 * margin; })!;
      chosen = { partId: part.id, sheetId: sheet.id, x: margin, y: margin, rotation };
    }
    placements.push(chosen);
  }
  return { sheetSize: { ...sheetSize }, orientation, margin, gap, parts, sheets, placements, unplacedPartIds };
}

export function preservePlacements(oldLayout: SheetLayout, source: readonly PartBounds[]): SheetLayout {
  const parts = source.map((part) => ({ ...part })).sort((a, b) => a.id.localeCompare(b.id));
  const oldParts = new Map(oldLayout.parts.map((part) => [part.id, part]));
  const sheets = oldLayout.sheets.map((sheet) => ({ ...sheet })), sheetsById = new Map(sheets.map((sheet) => [sheet.id, sheet])), partsById = new Map(parts.map((part) => [part.id, part]));
  const placements: Placement[] = [];
  const placed = new Set<string>();
  for (const placement of oldLayout.placements) {
    const part = partsById.get(placement.partId), previous = oldParts.get(placement.partId), sheet = sheetsById.get(placement.sheetId);
    if (!part || !previous || !sheet || placed.has(placement.partId) || part.width !== previous.width || part.height !== previous.height) continue;
    const d = dimensions(part, placement.rotation);
    const withinBounds = placement.x >= oldLayout.margin && placement.y >= oldLayout.margin
      && placement.x + d.width <= sheet.width - oldLayout.margin && placement.y + d.height <= sheet.height - oldLayout.margin;
    if (!withinBounds || placements.some((accepted) => accepted.sheetId === placement.sheetId
      && intersects(accepted, partsById.get(accepted.partId)!, placement, part, oldLayout.gap))) continue;
    placements.push({ ...placement });
    placed.add(placement.partId);
  }
  return { ...oldLayout, sheetSize: { ...oldLayout.sheetSize }, parts, sheets, placements, unplacedPartIds: parts.map(({ id }) => id).filter((id) => !placed.has(id)) };
}

export function arrangeParts(layout: SheetLayout): SheetLayout {
  return packParts(layout.parts, { sheetSize: layout.sheetSize, orientation: layout.orientation, margin: layout.margin, gap: layout.gap });
}
