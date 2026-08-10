import type { Document, Obj, ObjectGroup } from "./model";
import { boundsOf, pathLength } from "./objectEdit";
import { formatMm, roundMm } from "./util";
import { isSketchObjectId, entityIdFromObjectId } from "./sketch/bake";
import { getMacroDef } from "./macros/catalog";
import { groupBounds } from "./groups";

/** Short type codes for list scanning. */
export type ObjectKindCode = "L" | "C" | "R" | "S" | "P" | "I" | "M" | "G";

function pos(obj: Obj): string {
  const b = boundsOf(obj);
  if (!b) return "";
  return `@${formatMm(b.minX)},${formatMm(b.minY)}`;
}

function sizeBit(obj: Obj): string {
  if (obj.kind === "shape" && obj.shape.type === "rect") {
    return `${formatMm(obj.shape.width)}×${formatMm(obj.shape.height)}`;
  }
  if (obj.kind === "image") {
    return `${formatMm(obj.width)}×${formatMm(obj.height)}`;
  }
  if (obj.kind === "path") {
    if (obj.closed) {
      const b = boundsOf(obj);
      if (b) {
        const d = roundMm(Math.min(b.maxX - b.minX, b.maxY - b.minY));
        return `Ø${formatMm(d)}`;
      }
    } else {
      const len = pathLength(obj);
      if (len != null) return `${formatMm(len)}mm`;
    }
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") {
      return `Ø${formatMm(Number(obj.params.diameterMm))}`;
    }
    if (obj.defId === "slot") {
      return `${formatMm(Number(obj.params.lengthMm))}×${formatMm(Number(obj.params.widthMm))}`;
    }
    if (obj.defId === "round-rect") {
      return `${formatMm(Number(obj.params.widthMm))}×${formatMm(Number(obj.params.heightMm))}`;
    }
  }
  const b = boundsOf(obj);
  if (b) return `${formatMm(b.maxX - b.minX)}×${formatMm(b.maxY - b.minY)}`;
  return "";
}

export function objectTypeWord(obj: Obj): string {
  if (obj.kind === "shape") return "Rect";
  if (obj.kind === "image") return "Image";
  if (obj.kind === "path") {
    if (obj.closed) return "Circle";
    return "Line";
  }
  if (obj.kind === "macro") {
    if (obj.defId === "mount-hole" || obj.defId === "button") return "Circle";
    if (obj.defId === "slot") return "Slot";
    if (obj.defId === "round-rect") return "Round";
    return getMacroDef(obj.defId)?.name ?? "Macro";
  }
  return "Object";
}

/**
 * Human list label — unique enough to scan:
 *   L3 · 50mm @10,20
 *   C1 · Ø12 @40,5
 *   R2 · 40×30 @0,0
 * Prefer custom name when set.
 */
export function objectListLabel(obj: Obj, doc: Document): string {
  if (obj.name?.trim()) {
    const size = sizeBit(obj);
    const p = pos(obj);
    const bits = [obj.name.trim(), size, p].filter(Boolean);
    // Avoid "My hole · Ø10 · @x,y" too long — name + size is enough
    return size ? `${obj.name.trim()} · ${size}` : obj.name.trim();
  }

  const type = objectTypeWord(obj);
  const n = sequenceNumber(obj, doc);
  const size = sizeBit(obj);
  const p = pos(obj);
  const parts = [`${type} ${n}`, size, p].filter(Boolean);
  let label = parts.join(" · ");
  if (obj.kind !== "image" && obj.construction) {
    label += " · ref";
  }
  return label;
}

/** 1-based index among objects of the same type word in document order. */
export function sequenceNumber(obj: Obj, doc: Document): number {
  const type = objectTypeWord(obj);
  let n = 0;
  for (const o of doc.objects) {
    if (objectTypeWord(o) === type) n += 1;
    if (o.id === obj.id) return n;
  }
  return n || 1;
}

export function groupListLabel(group: ObjectGroup, doc: Document): string {
  if (group.name?.trim() && !/^Rect\s+\d+$/i.test(group.name) && !/^Group\s+\d+$/i.test(group.name)) {
    return `${group.name.trim()} · ${group.memberIds.length}`;
  }
  const members = group.memberIds
    .map((id) => doc.objects.find((o) => o.id === id))
    .filter(Boolean) as Obj[];
  const b = groupBounds(doc.objects, group.memberIds);
  const size =
    b != null
      ? `${formatMm(b.maxX - b.minX)}×${formatMm(b.maxY - b.minY)}`
      : "";
  const at =
    b != null ? `@${formatMm(b.minX)},${formatMm(b.minY)}` : "";
  // Default auto names: "Rect 1" → enrich with size
  const base = group.name?.trim() || `Group`;
  return [base, size, at].filter(Boolean).join(" · ");
}

/** Suggest next free name like Line 3 / Circle 2 for creation. */
export function nextAutoName(doc: Document, typeWord: string): string {
  const used = new Set<string>();
  for (const o of doc.objects) {
    if (o.name) used.add(o.name.trim().toLowerCase());
    // also reserve sequence labels
    used.add(`${objectTypeWord(o)} ${sequenceNumber(o, doc)}`.toLowerCase());
  }
  for (const g of doc.groups ?? []) {
    if (g.name) used.add(g.name.trim().toLowerCase());
  }
  // Count existing of type
  let max = 0;
  for (const o of doc.objects) {
    if (objectTypeWord(o) === typeWord) max += 1;
  }
  for (const g of doc.groups ?? []) {
    if (g.name.toLowerCase().startsWith(typeWord.toLowerCase())) max += 1;
  }
  let n = max + 1;
  while (used.has(`${typeWord} ${n}`.toLowerCase())) n += 1;
  return `${typeWord} ${n}`;
}

/** Assign name onto a newly created object if missing. */
export function withAutoName<T extends Obj>(obj: T, doc: Document, typeWord?: string): T {
  if (obj.name?.trim()) return obj;
  const word = typeWord ?? objectTypeWord(obj);
  return { ...obj, name: nextAutoName(doc, word) };
}

/** Rename object (and sketch entity if sketch-backed). */
export function applyObjectName(obj: Obj, name: string): Partial<Obj> {
  return { name: name.trim() || undefined };
}

export function sketchEntityNameFromObjectId(
  doc: Document,
  objectId: string
): string | undefined {
  if (!isSketchObjectId(objectId) || !doc.sketch) return undefined;
  const eid = entityIdFromObjectId(objectId);
  if (!eid) return undefined;
  return doc.sketch.entities[eid]?.name;
}
