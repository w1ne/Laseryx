import type React from "react";
import type { Action } from "../state/actions";
import type { AppState } from "../state/types";
import {
  addConstraint,
  addParameter,
  drawCircle,
  drawLine,
  drawRect,
  ensureSketch,
  type SketchConstraint,
  type SketchDocument,
  solveSketch,
  syncDocumentSketch
} from "../sketch";
import { entityIdFromObjectId, isSketchObjectId, sketchObjectId } from "../sketch/bake";
import { deleteConstraint, deleteEntity, getLine } from "../sketch/create";
import { signedPerpOffset } from "../sketch/dimAnnotations";
import { defaultGroupName, listGroups, newGroupId } from "../groups";
import { nextAutoName } from "../objectLabels";
import { GroupService } from "./GroupService";
import { createDimensionBetween, type DimPick } from "../sketch/dimension";
import { roundMm } from "../util";

function commitSketch(
  state: AppState,
  dispatch: React.Dispatch<Action>,
  sketch: SketchDocument,
  opts?: {
    selectObjectId?: string | null;
    /** Select many (e.g. a group) */
    selectObjectIds?: string[];
    /** Auto-group these object ids so the list stays compact */
    groupAs?: { name: string; memberIds: string[] };
  }
) {
  const solved = solveSketch(sketch);
  let { document } = syncDocumentSketch(
    {
      ...state.document,
      sketch: solved.sketch,
      sketchStatus: solved.status
    },
    { skipSolve: true }
  );

  if (opts?.groupAs && opts.groupAs.memberIds.length >= 2) {
    const groups = listGroups(document).filter(
      (g) => !g.memberIds.some((id) => opts.groupAs!.memberIds.includes(id))
    );
    groups.push({
      id: newGroupId(),
      name: opts.groupAs.name || defaultGroupName(document),
      memberIds: [...opts.groupAs.memberIds]
    });
    document = { ...document, groups };
  }

  dispatch({
    type: "SET_DOCUMENT",
    payload: {
      ...document,
      sketchStatus: solved.status
    }
  });
  if (opts?.selectObjectIds && opts.selectObjectIds.length > 0) {
    dispatch({ type: "SET_SELECTION", payload: opts.selectObjectIds });
  } else if (opts?.selectObjectId !== undefined) {
    dispatch({ type: "SELECT_OBJECT", payload: opts.selectObjectId });
  }
}

export const SketchService = {
  setSketch(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    sketch: SketchDocument,
    selectObjectId?: string | null
  ) {
    commitSketch(state, dispatch, sketch, { selectObjectId });
  },

  drawLine(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    a: { x: number; y: number },
    b: { x: number; y: number },
    opts?: {
      ortho?: boolean;
      construction?: boolean;
      /** Snap joint: existing sketch point id at start */
      coincidentStart?: string;
      /** Snap joint: existing sketch point id at end */
      coincidentEnd?: string;
    }
  ) {
    let s = ensureSketch(state.document.sketch);
    let bb = { ...b };
    if (opts?.ortho) {
      if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) bb = { x: b.x, y: a.y };
      else bb = { x: a.x, y: b.y };
    }
    // Soft ortho: nearly H/V without shift
    if (!opts?.ortho) {
      const dx = Math.abs(bb.x - a.x);
      const dy = Math.abs(bb.y - a.y);
      if (dx > 1e-6 && dy / dx < 0.08) bb = { x: bb.x, y: a.y };
      else if (dy > 1e-6 && dx / dy < 0.08) bb = { x: a.x, y: bb.y };
    }

    // If snapping to an existing point, seed coords from that point
    if (opts?.coincidentStart && s.points[opts.coincidentStart]) {
      const p = s.points[opts.coincidentStart];
      a = { x: p.x, y: p.y };
    }
    if (opts?.coincidentEnd && s.points[opts.coincidentEnd]) {
      const p = s.points[opts.coincidentEnd];
      bb = { x: p.x, y: p.y };
    }

    const lineName = nextAutoName(state.document, "Line");
    const d = drawLine(s, a, bb, { construction: opts?.construction, name: lineName });
    s = d.sketch;
    const len = Math.hypot(bb.x - a.x, bb.y - a.y);
    const isH = Math.abs(bb.y - a.y) < 1e-9;
    const isV = Math.abs(bb.x - a.x) < 1e-9;
    if (isH) s = addConstraint(s, { type: "horizontal", lineId: d.line.id }).sketch;
    if (isV) s = addConstraint(s, { type: "vertical", lineId: d.line.id }).sketch;
    if (len > 0.05) {
      s = addConstraint(s, {
        type: "length",
        lineId: d.line.id,
        value: { kind: "literal", value: len }
      }).sketch;
    }
    if (opts?.coincidentStart && s.points[opts.coincidentStart]) {
      s = addConstraint(s, {
        type: "coincident",
        a: d.p1.id,
        b: opts.coincidentStart
      }).sketch;
    }
    if (opts?.coincidentEnd && s.points[opts.coincidentEnd]) {
      s = addConstraint(s, {
        type: "coincident",
        a: d.p2.id,
        b: opts.coincidentEnd
      }).sketch;
    }
    commitSketch(state, dispatch, s, { selectObjectId: `sketch:${d.line.id}` });
    return d.line.id;
  },

  drawCircle(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    center: { x: number; y: number },
    diameter: number,
    opts?: { construction?: boolean }
  ) {
    let s = ensureSketch(state.document.sketch);
    const circleName = nextAutoName(state.document, "Circle");
    const d = drawCircle(s, center, Math.max(0.25, diameter / 2), {
      construction: opts?.construction,
      name: circleName
    });
    s = d.sketch;
    s = addConstraint(s, {
      type: "diameter",
      circleId: d.circle.id,
      value: { kind: "literal", value: Math.max(0.5, diameter) }
    }).sketch;
    commitSketch(state, dispatch, s, { selectObjectId: `sketch:${d.circle.id}` });
    return d.circle.id;
  },

  drawRect(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    box: { x: number; y: number; w: number; h: number },
    opts?: { construction?: boolean }
  ) {
    const x = Math.min(box.x, box.x + box.w);
    const y = Math.min(box.y, box.y + box.h);
    const w = Math.max(0.5, Math.abs(box.w));
    const h = Math.max(0.5, Math.abs(box.h));
    let s = ensureSketch(state.document.sketch);
    const r = drawRect(s, x, y, w, h, { construction: opts?.construction });
    s = r.sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: r.lines[0].id,
      value: { kind: "literal", value: w }
    }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: r.lines[1].id,
      value: { kind: "literal", value: h }
    }).sketch;
    s = addConstraint(s, { type: "fix", pointId: r.points[0].id }).sketch;
    // Four lines stay in the solver, but appear as ONE named group in the object list
    const memberIds = r.lines.map((l) => sketchObjectId(l.id));
    // Name edges for expand/ungroup, group itself is "Rect N"
    const rectName = nextAutoName(state.document, "Rect");
    let named = s;
    r.lines.forEach((line, i) => {
      const ent = named.entities[line.id];
      if (ent && ent.kind === "line") {
        named = {
          ...named,
          entities: {
            ...named.entities,
            [line.id]: { ...ent, name: `${rectName} · edge ${i + 1}` }
          }
        };
      }
    });
    commitSketch(state, dispatch, named, {
      selectObjectIds: memberIds,
      groupAs: { name: rectName, memberIds }
    });
    return r.lines.map((l) => l.id);
  },

  addConstraint(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    constraint: Omit<SketchConstraint, "id"> & { id?: string }
  ) {
    let s = ensureSketch(state.document.sketch);
    s = addConstraint(s, constraint).sketch;
    commitSketch(state, dispatch, s);
  },

  /**
   * Apply constraint using multi-select when available.
   * - H/V/Fix: each selected line/entity
   * - Two-entity (∥ ⊥ = ⊙ R= ◎): needs exactly 2 sketch entities of compatible kind
   */
  applyConstraintType(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    type:
      | "horizontal"
      | "vertical"
      | "coincident"
      | "parallel"
      | "perpendicular"
      | "equalLength"
      | "equalRadius"
      | "fix"
      | "concentric"
  ): boolean {
    const sketch = state.document.sketch;
    if (!sketch) return false;

    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    const entityIds = ids
      .filter(isSketchObjectId)
      .map((id) => entityIdFromObjectId(id))
      .filter((id): id is string => !!id && !!sketch.entities[id]);

    if (entityIds.length === 0) return false;

    if (type === "horizontal" || type === "vertical") {
      let any = false;
      let s = ensureSketch(sketch);
      for (const eid of entityIds) {
        const e = s.entities[eid];
        if (e?.kind === "line") {
          s = addConstraint(s, { type, lineId: e.id }).sketch;
          any = true;
        }
      }
      if (!any) return false;
      commitSketch(state, dispatch, s);
      return true;
    }

    if (type === "fix") {
      let any = false;
      let s = ensureSketch(sketch);
      for (const eid of entityIds) {
        const e = s.entities[eid];
        if (e?.kind === "line") {
          s = addConstraint(s, { type: "fix", pointId: e.p1 }).sketch;
          any = true;
        } else if (e?.kind === "circle") {
          s = addConstraint(s, { type: "fix", pointId: e.center }).sketch;
          any = true;
        }
      }
      if (!any) return false;
      commitSketch(state, dispatch, s);
      return true;
    }

    // Prefer first two selected; fall back to last two sketch entities of kind
    if (entityIds.length >= 2) {
      const a = sketch.entities[entityIds[entityIds.length - 2]];
      const b = sketch.entities[entityIds[entityIds.length - 1]];
      if (!a || !b) return false;

      if (type === "coincident" && a.kind === "line" && b.kind === "line") {
        // Join nearest endpoints
        const pts = sketch.points;
        const endsA = [a.p1, a.p2];
        const endsB = [b.p1, b.p2];
        let best = { da: endsA[0], db: endsB[0], d: Infinity };
        for (const ea of endsA) {
          for (const eb of endsB) {
            const pa = pts[ea];
            const pb = pts[eb];
            if (!pa || !pb) continue;
            const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
            if (d < best.d) best = { da: ea, db: eb, d };
          }
        }
        this.addConstraint(state, dispatch, { type: "coincident", a: best.da, b: best.db });
        return true;
      }

      if (
        (type === "parallel" || type === "perpendicular" || type === "equalLength") &&
        a.kind === "line" &&
        b.kind === "line"
      ) {
        this.addConstraint(state, dispatch, {
          type,
          lineA: a.id,
          lineB: b.id
        } as Omit<SketchConstraint, "id">);
        return true;
      }

      if (
        (type === "equalRadius" || type === "concentric") &&
        a.kind === "circle" &&
        b.kind === "circle"
      ) {
        this.addConstraint(state, dispatch, {
          type,
          circleA: a.id,
          circleB: b.id
        } as Omit<SketchConstraint, "id">);
        return true;
      }
    }

    return false;
  },

  /**
   * Drag a sketch point to a new seed position, then re-solve.
   * During live drag, pass skipSolve via moveSketchPointLive + commit later.
   */
  moveSketchPoint(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    pointId: string,
    x: number,
    y: number,
    opts?: { skipSolve?: boolean; selectObjectId?: string | null }
  ) {
    const sketch = state.document.sketch;
    if (!sketch || !sketch.points[pointId]) return;
    let s = ensureSketch(sketch);
    s = {
      ...s,
      points: {
        ...s.points,
        [pointId]: { ...s.points[pointId], x, y }
      }
    };

    // Keep dimensional length constraints in sync with the drag so the solver
    // does not snap the endpoint back to the old length.
    if (!opts?.skipSolve) {
      const constraints = { ...s.constraints };
      for (const e of Object.values(s.entities)) {
        if (e.kind !== "line") continue;
        if (e.p1 !== pointId && e.p2 !== pointId) continue;
        const p1 = s.points[e.p1];
        const p2 = s.points[e.p2];
        if (!p1 || !p2) continue;
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        for (const [cid, c] of Object.entries(constraints)) {
          if (c.type === "length" && c.lineId === e.id) {
            constraints[cid] = {
              ...c,
              value: { kind: "literal", value: Math.max(0.1, len) }
            };
          }
        }
      }
      s = { ...s, constraints };
    }

    if (opts?.skipSolve) {
      const { document } = syncDocumentSketch(
        { ...state.document, sketch: s },
        { skipSolve: true }
      );
      dispatch({ type: "SET_DOCUMENT", payload: document, skipHistory: true });
      return;
    }
    commitSketch(state, dispatch, s, { selectObjectId: opts?.selectObjectId });
  },

  setParameter(state: AppState, dispatch: React.Dispatch<Action>, name: string, value: number) {
    let s = ensureSketch(state.document.sketch);
    const existing = Object.values(s.parameters).find((p) => p.name === name);
    if (existing) {
      s = {
        ...s,
        parameters: {
          ...s.parameters,
          [existing.id]: { ...existing, value }
        }
      };
    } else {
      s = addParameter(s, name, value).sketch;
    }
    commitSketch(state, dispatch, s);
  },

  setDimLiteral(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    entityObjectId: string,
    kind: "length" | "diameter",
    value: number
  ) {
    const eid = entityIdFromObjectId(entityObjectId);
    if (!eid || !state.document.sketch) return;
    let s = ensureSketch(state.document.sketch);
    const ent = s.entities[eid];
    if (!ent) return;

    // Update existing dim constraint or add
    const existing = Object.values(s.constraints).find((c) => {
      if (kind === "length") return c.type === "length" && c.lineId === eid;
      return c.type === "diameter" && c.circleId === eid;
    });
    if (existing && (existing.type === "length" || existing.type === "diameter")) {
      s = {
        ...s,
        constraints: {
          ...s.constraints,
          [existing.id]: {
            ...existing,
            value: { kind: "literal", value }
          }
        }
      };
    } else if (kind === "length" && ent.kind === "line") {
      s = addConstraint(s, {
        type: "length",
        lineId: ent.id,
        value: { kind: "literal", value }
      }).sketch;
    } else if (kind === "diameter" && ent.kind === "circle") {
      s = addConstraint(s, {
        type: "diameter",
        circleId: ent.id,
        value: { kind: "literal", value }
      }).sketch;
    }
    commitSketch(state, dispatch, s, { selectObjectId: entityObjectId });
  },

  deleteSketchObject(state: AppState, dispatch: React.Dispatch<Action>, objectId: string) {
    if (!isSketchObjectId(objectId)) return false;
    return GroupService.deleteObjects(state, dispatch, [objectId]);
  },

  reSolve(state: AppState, dispatch: React.Dispatch<Action>) {
    if (!state.document.sketch) return;
    commitSketch(state, dispatch, state.document.sketch);
  },

  /** Remove one constraint and re-solve. */
  removeConstraint(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    constraintId: string
  ) {
    if (!state.document.sketch?.constraints[constraintId]) return;
    const s = deleteConstraint(state.document.sketch, constraintId);
    commitSketch(state, dispatch, s);
  },

  /**
   * Fusion-style smart dimension between two picks (point/line/circle).
   * Optional placeWorld stores display offset (dim line parallel to geometry).
   */
  applyDimension(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    first: DimPick,
    second: DimPick | null,
    opts?: {
      valueMm?: number;
      skipPrompt?: boolean;
      /** World point where user placed the dim (projected to pure perpendicular). */
      placeWorld?: { x: number; y: number };
    }
  ): { ok: boolean; message: string } {
    const sketch = state.document.sketch;
    if (!sketch) return { ok: false, message: "No sketch" };

    const draft = createDimensionBetween(sketch, first, second, opts?.valueMm);
    if (!draft.ok) return { ok: false, message: draft.reason };

    // Prefer explicit value / skipPrompt (HUD). Never use window.prompt in normal UI path.
    const value = opts?.valueMm ?? draft.measuredMm;
    if (!(Number.isFinite(value) && value >= 0)) {
      return { ok: false, message: "Invalid number" };
    }

    const final = createDimensionBetween(sketch, first, second, value);
    if (!final.ok) return { ok: false, message: final.reason };

    let constraint = final.constraint as typeof final.constraint & { offsetMm?: number };
    if (opts?.placeWorld) {
      const offset = computeDimOffsetMm(sketch, first, second, opts.placeWorld);
      if (offset != null) constraint = { ...constraint, offsetMm: offset };
    }

    let s = ensureSketch(sketch);
    s = addConstraint(s, constraint).sketch;
    commitSketch(state, dispatch, s);
    return { ok: true, message: final.summary };
  },

  /** Change an existing dimensional constraint value and re-solve (Fusion in-place edit). */
  setDimValue(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    constraintId: string,
    valueMm: number
  ): { ok: boolean; message: string } {
    const sketch = state.document.sketch;
    if (!sketch) return { ok: false, message: "No sketch" };
    const c = sketch.constraints[constraintId];
    if (!c) return { ok: false, message: "Dimension not found" };
    if (
      c.type !== "length" &&
      c.type !== "distance" &&
      c.type !== "pointLineDistance" &&
      c.type !== "diameter" &&
      c.type !== "radius"
    ) {
      return { ok: false, message: "Not a size dimension" };
    }
    if (!(Number.isFinite(valueMm) && valueMm >= 0)) {
      return { ok: false, message: "Invalid number" };
    }
    const nextVal = { kind: "literal" as const, value: Math.max(0.05, valueMm) };
    const next = {
      ...sketch,
      constraints: {
        ...sketch.constraints,
        [constraintId]: { ...c, value: nextVal }
      }
    };
    commitSketch(state, dispatch, next);
    return { ok: true, message: `Set ${roundMm(valueMm)} mm` };
  },

  /**
   * Drag dimension annotation: update display offset only (no re-solve needed).
   * live=true skips history; call again with live=false (or commitHistory) to snapshot.
   */
  setDimOffset(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    constraintId: string,
    offsetMm: number,
    opts?: { live?: boolean }
  ) {
    const sketch = state.document.sketch;
    if (!sketch) return;
    const c = sketch.constraints[constraintId];
    if (!c) return;
    if (
      c.type !== "length" &&
      c.type !== "distance" &&
      c.type !== "pointLineDistance" &&
      c.type !== "diameter" &&
      c.type !== "radius"
    ) {
      return;
    }
    const next = {
      ...sketch,
      constraints: {
        ...sketch.constraints,
        [constraintId]: { ...c, offsetMm }
      }
    };
    // Offset is display-only — keep geometry, skip solve churn
    const document = {
      ...state.document,
      sketch: next
    };
    dispatch({
      type: "SET_DOCUMENT",
      payload: document,
      skipHistory: opts?.live === true
    });
  }
};

/** Signed perp offset from place for the dim's anchor segment (Fusion linear dims). */
function computeDimOffsetMm(
  sketch: SketchDocument,
  first: DimPick,
  second: DimPick | null,
  place: { x: number; y: number }
): number | null {
  if (!second && first.kind === "line") {
    const line = getLine(sketch, first.lineId);
    if (!line) return null;
    const a = sketch.points[line.p1];
    const b = sketch.points[line.p2];
    if (!a || !b) return null;
    const o = signedPerpOffset(a, b, place);
    return Math.abs(o) < 1.5 ? (o >= 0 ? 8 : -8) : o;
  }
  if (!second && first.kind === "circle") {
    const e = sketch.entities[first.circleId];
    if (!e || e.kind !== "circle") return null;
    const c0 = sketch.points[e.center];
    if (!c0) return null;
    return Math.max(2, Math.abs(c0.y - place.y) - e.r);
  }
  if (first.kind === "point" && second?.kind === "point") {
    const a = sketch.points[first.pointId];
    const b = sketch.points[second.pointId];
    if (!a || !b) return null;
    const o = signedPerpOffset(a, b, place);
    return Math.abs(o) < 1.5 ? (o >= 0 ? 8 : -8) : o;
  }
  if (
    (first.kind === "point" && second?.kind === "line") ||
    (first.kind === "line" && second?.kind === "point")
  ) {
    const lineId = first.kind === "line" ? first.lineId : second!.kind === "line" ? second.lineId : null;
    if (!lineId) return null;
    const line = getLine(sketch, lineId);
    if (!line) return null;
    const la = sketch.points[line.p1];
    const lb = sketch.points[line.p2];
    if (!la || !lb) return null;
    const dx = lb.x - la.x;
    const dy = lb.y - la.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (la.x + lb.x) / 2;
    const my = (la.y + lb.y) / 2;
    return ((place.x - mx) * dx + (place.y - my) * dy) / len;
  }
  return 8;
}
