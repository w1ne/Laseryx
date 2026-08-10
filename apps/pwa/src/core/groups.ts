import type { Document, ObjectGroup, Obj } from "./model";
import type { SketchDocument } from "./sketch/types";
import { entityIdFromObjectId, isSketchObjectId } from "./sketch/bake";
import { boundsOf, type BBox } from "./objectEdit";
import { roundMm } from "./util";

let seq = 0;
export function newGroupId(): string {
  seq += 1;
  return `grp-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function listGroups(doc: Document): ObjectGroup[] {
  return doc.groups ?? [];
}

export function findGroupContaining(doc: Document, objectId: string): ObjectGroup | undefined {
  return listGroups(doc).find((g) => g.memberIds.includes(objectId));
}

/** Expand selection to include full groups for any selected member. */
export function expandSelectionWithGroups(doc: Document, ids: string[]): string[] {
  const set = new Set(ids);
  for (const id of ids) {
    const g = findGroupContaining(doc, id);
    if (g) for (const m of g.memberIds) set.add(m);
  }
  // Drop ids that no longer exist
  const existing = new Set(doc.objects.map((o) => o.id));
  return [...set].filter((id) => existing.has(id));
}

export function groupBounds(objects: Obj[], memberIds: string[]): BBox | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let any = false;
  for (const id of memberIds) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) continue;
    const b = boundsOf(obj);
    if (!b) continue;
    any = true;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!any) return null;
  return { minX, minY, maxX, maxY };
}

/** Collect unique sketch point ids owned by the given object ids. */
export function sketchPointIdsForObjects(
  sketch: SketchDocument | null | undefined,
  objectIds: string[]
): string[] {
  if (!sketch) return [];
  const pts = new Set<string>();
  for (const oid of objectIds) {
    if (!isSketchObjectId(oid)) continue;
    const eid = entityIdFromObjectId(oid);
    if (!eid) continue;
    const e = sketch.entities[eid];
    if (!e) continue;
    if (e.kind === "line") {
      pts.add(e.p1);
      pts.add(e.p2);
    } else if (e.kind === "circle") {
      pts.add(e.center);
    }
  }
  return [...pts];
}

/**
 * Translate free objects (transform.e/f) and sketch points by (dx,dy).
 * Returns next document pieces — caller dispatches.
 */
export function translateMembers(
  doc: Document,
  memberIds: string[],
  dx: number,
  dy: number
): { objects: Obj[]; sketch: SketchDocument | null | undefined } {
  const dxr = roundMm(dx);
  const dyr = roundMm(dy);
  const idSet = new Set(memberIds);

  const objects = doc.objects.map((obj) => {
    if (!idSet.has(obj.id)) return obj;
    if (isSketchObjectId(obj.id)) return obj; // sketch geometry comes from bake
    return {
      ...obj,
      transform: {
        ...obj.transform,
        e: roundMm(obj.transform.e + dxr),
        f: roundMm(obj.transform.f + dyr)
      }
    };
  });

  let sketch = doc.sketch;
  if (sketch) {
    const pointIds = sketchPointIdsForObjects(sketch, memberIds);
    if (pointIds.length > 0) {
      const points = { ...sketch.points };
      for (const pid of pointIds) {
        const p = points[pid];
        if (!p) continue;
        points[pid] = { ...p, x: roundMm(p.x + dxr), y: roundMm(p.y + dyr) };
      }
      sketch = { ...sketch, points };
    }
  }

  return { objects, sketch };
}

export function pruneGroups(doc: Document): ObjectGroup[] {
  const existing = new Set(doc.objects.map((o) => o.id));
  return listGroups(doc)
    .map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => existing.has(id))
    }))
    .filter((g) => g.memberIds.length >= 2);
}

export function defaultGroupName(doc: Document): string {
  const n = listGroups(doc).length + 1;
  return `Group ${n}`;
}

/**
 * Compact list rows for the Objects panel:
 * - one row per group (members hidden)
 * - ungrouped objects only
 * So a rectangle is 1 row, not 4 lines.
 */
export type ObjectListRow =
  | { kind: "group"; groupId: string; name: string; memberIds: string[] }
  | { kind: "object"; objectId: string };

export function buildObjectListRows(doc: Document): ObjectListRow[] {
  const groups = listGroups(doc);
  const grouped = new Set(groups.flatMap((g) => g.memberIds));
  const rows: ObjectListRow[] = [];

  // Groups first (stable by name then id)
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of sortedGroups) {
    rows.push({
      kind: "group",
      groupId: g.id,
      name: g.name,
      memberIds: g.memberIds
    });
  }

  for (const obj of doc.objects) {
    if (grouped.has(obj.id)) continue;
    rows.push({ kind: "object", objectId: obj.id });
  }
  return rows;
}
