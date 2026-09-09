import type React from "react";
import type { Action } from "../state/actions";
import type { AppState } from "../state/types";
import {
  defaultGroupName,
  expandSelectionWithGroups,
  findGroupContaining,
  listGroups,
  newGroupId,
  pruneGroups,
  translateMembers
} from "../groups";
import { syncDocumentSketch } from "../sketch/sync";
import { entityIdFromObjectId, isSketchObjectId } from "../sketch/bake";
import { deleteEntity } from "../sketch/create";
import { solveSketch } from "../sketch/solver";
import { componentIdForSourceCutout } from "../enclosure/componentDrag";

function setDoc(
  dispatch: React.Dispatch<Action>,
  doc: AppState["document"],
  opts?: { skipHistory?: boolean }
) {
  dispatch({ type: "SET_DOCUMENT", payload: doc, skipHistory: opts?.skipHistory });
}

export const GroupService = {
  updateEnclosurePlacement(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    memberIds: string[],
    changes: Partial<Pick<Extract<Action, { type: "UPDATE_ENCLOSURE_PLACEMENT" }>["payload"], "x" | "y" | "rotation">>,
    opts?: { skipHistory?: boolean; baseDocument?: AppState["document"] }
  ): boolean {
    const document = opts?.baseDocument ?? state.document, workspace = document.enclosureWorkspace;
    if (!workspace?.sheetLayout) return false;
    const selected = new Set(memberIds), group = listGroups(document).find((candidate) => candidate.memberIds.length === selected.size && candidate.memberIds.every((id) => selected.has(id)));
    const partId = group && workspace.sheetLayout.parts.find(({ id }) => group.id === `components-box:${workspace.enclosure.id}:face:${id}` || (id === "fit-coupon" && group.id === `components-box:${workspace.enclosure.id}:coupon`))?.id;
    const placement = partId ? workspace.sheetLayout.placements.find((item) => item.partId === partId) : undefined;
    if (!placement) return false;
    dispatch({ type: "UPDATE_ENCLOSURE_PLACEMENT", payload: { ...placement, ...changes }, skipHistory: opts?.skipHistory });
    return true;
  },
  /** Create a group from current multi-selection (≥2). */
  groupSelection(state: AppState, dispatch: React.Dispatch<Action>): string | null {
    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    const unique = [...new Set(ids)];
    if (unique.some((id) => id.startsWith("components-box:"))) return null;
    if (unique.length < 2) return null;

    // Remove members from existing groups (they leave old groups)
    let groups = listGroups(state.document).map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => !unique.includes(id))
    }));
    groups = groups.filter((g) => g.memberIds.length >= 2);

    const group = {
      id: newGroupId(),
      name: defaultGroupName(state.document),
      memberIds: unique
    };
    groups = [...groups, group];

    setDoc(dispatch, { ...state.document, groups });
    dispatch({ type: "SET_SELECTION", payload: unique });
    return group.id;
  },

  /** Ungroup: dissolve groups that intersect the selection. */
  ungroupSelection(state: AppState, dispatch: React.Dispatch<Action>): boolean {
    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    if (ids.length === 0) return false;
    if (ids.some((id) => id.startsWith("components-box:"))) return false;

    const dissolve = new Set(
      listGroups(state.document)
        .filter((g) => g.memberIds.some((m) => ids.includes(m)))
        .map((g) => g.id)
    );
    if (dissolve.size === 0) return false;

    const groups = listGroups(state.document).filter((g) => !dissolve.has(g.id));
    setDoc(dispatch, { ...state.document, groups });
    return true;
  },

  /**
   * Select object, expanding to its group unless additive.
   * Returns the resulting selection ids (sync) so drag can start as multi-move.
   */
  selectWithGroup(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    objectId: string | null,
    opts?: { additive?: boolean }
  ): string[] {
    if (objectId == null) {
      dispatch({ type: "SELECT_OBJECT", payload: null });
      return [];
    }
    if (opts?.additive) {
      const has = state.selectedObjectIds.includes(objectId);
      const next = has
        ? state.selectedObjectIds.filter((id) => id !== objectId)
        : [...state.selectedObjectIds, objectId];
      dispatch({ type: "SET_SELECTION", payload: next });
      return next;
    }
    const workspace = state.document.enclosureWorkspace;
    if (workspace && componentIdForSourceCutout(workspace, objectId)) {
      dispatch({ type: "SELECT_OBJECT", payload: objectId });
      return [objectId];
    }
    const g = findGroupContaining(state.document, objectId);
    if (g) {
      const members = [...g.memberIds];
      dispatch({ type: "SET_SELECTION", payload: members });
      return members;
    }
    dispatch({ type: "SELECT_OBJECT", payload: objectId });
    return [objectId];
  },

  /** After any additive toggle, optionally expand full groups in selection. */
  expandCurrentSelection(state: AppState, dispatch: React.Dispatch<Action>) {
    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    const expanded = expandSelectionWithGroups(state.document, ids);
    if (
      expanded.length !== ids.length ||
      expanded.some((id, i) => id !== ids[i])
    ) {
      dispatch({ type: "SET_SELECTION", payload: expanded });
    }
  },

  /**
   * Translate members by dx,dy in mm relative to a base document snapshot
   * (use snapshot during live drag so absolute deltas stay correct).
   */
  translateSelection(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    memberIds: string[],
    dx: number,
    dy: number,
    opts?: { live?: boolean; baseDocument?: AppState["document"] }
  ) {
    if (memberIds.length === 0) return;
    const base = opts?.baseDocument ?? state.document;
    if (dx === 0 && dy === 0 && !opts?.live) return;

    const panelWorkspace = base.enclosureWorkspace;
    const panelGroup = panelWorkspace && !panelWorkspace.enclosure.result && listGroups(base).find((candidate) => candidate.id === `components-box:panel:${panelWorkspace.sourcePanel.id}` && candidate.memberIds.length === memberIds.length && candidate.memberIds.every((id) => memberIds.includes(id)));
    if (panelGroup) {
      const transform = panelWorkspace.sourcePanel.transform;
      dispatch({ type: "UPDATE_PANEL_TRANSFORM", payload: { ...transform, e: transform.e + dx, f: transform.f + dy }, skipHistory: opts?.live });
      return;
    }

    const workspacePlacement = base.enclosureWorkspace?.sheetLayout?.placements.find((placement) => {
      const group = listGroups(base).find((candidate) => candidate.memberIds.length === memberIds.length && candidate.memberIds.every((id) => memberIds.includes(id)));
      return group?.id === `components-box:${base.enclosureWorkspace?.enclosure.id}:face:${placement.partId}` || (placement.partId === "fit-coupon" && group?.id === `components-box:${base.enclosureWorkspace?.enclosure.id}:coupon`);
    });
    if (workspacePlacement && this.updateEnclosurePlacement(state, dispatch, memberIds, { x: workspacePlacement.x + dx, y: workspacePlacement.y + dy }, { skipHistory: opts?.live, baseDocument: base })) return;

    const { objects, sketch } = translateMembers(base, memberIds, dx, dy);
    let doc = {
      ...base,
      objects,
      sketch: sketch ?? base.sketch,
      groups: pruneGroups({ ...base, objects })
    };

    if (sketch) {
      const synced = syncDocumentSketch(doc, { skipSolve: true });
      doc = { ...synced.document, groups: doc.groups ?? base.groups };
    }

    setDoc(dispatch, doc, { skipHistory: opts?.live });
  },

  renameGroup(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    groupId: string,
    name: string
  ) {
    const groups = listGroups(state.document).map((g) =>
      g.id === groupId ? { ...g, name: name.trim() || g.name } : g
    );
    setDoc(dispatch, { ...state.document, groups });
  },

  /** Delete a whole group and all its members (one history step). */
  deleteGroup(state: AppState, dispatch: React.Dispatch<Action>, groupId: string): boolean {
    const g = listGroups(state.document).find((x) => x.id === groupId);
    if (!g) return false;
    return this.deleteObjects(state, dispatch, g.memberIds);
  },

  /**
   * Delete one or many objects (sketch + free). Removes sketch entities, prunes groups,
   * re-bakes sketch. No browser confirm — callers decide.
   */
  deleteObjects(
    state: AppState,
    dispatch: React.Dispatch<Action>,
    objectIds: string[]
  ): boolean {
    const ids = [...new Set(objectIds.filter(Boolean))];
    if (ids.length === 0) return false;
    if (ids.some((id) => id.startsWith("components-box:"))) {
      const workspace = state.document.enclosureWorkspace;
      if (!workspace || ids.some((id) => !id.startsWith("components-box:"))) return false;
      const componentIds = ids.map((id) => componentIdForSourceCutout(workspace, id));
      if (componentIds.some((id) => !id)) return false;
      dispatch({ type: "DELETE_COMPONENT_INSTANCES", payload: [...new Set(componentIds as string[])] });
      return true;
    }

    // If any id is in a group and the selection is exactly that group (or a superset
    // that includes full groups), remove whole groups via member set already in ids.
    // Expand: when primary is one member but selectedObjectIds has the group, caller
    // should pass full selectedObjectIds.

    const idSet = new Set(ids);
    let sketch = state.document.sketch ? structuredClone(state.document.sketch) : null;

    if (sketch) {
      for (const id of ids) {
        if (!isSketchObjectId(id)) continue;
        const eid = entityIdFromObjectId(id);
        if (eid && sketch.entities[eid]) {
          sketch = deleteEntity(sketch, eid);
        }
      }
      // Drop orphaned points not referenced by remaining entities
      sketch = pruneUnusedPoints(sketch);
      const solved = solveSketch(sketch);
      sketch = solved.sketch;
    }

    const objects = state.document.objects.filter((o) => !idSet.has(o.id));
    const groups = listGroups(state.document)
      .map((g) => ({
        ...g,
        memberIds: g.memberIds.filter((m) => !idSet.has(m))
      }))
      .filter((g) => g.memberIds.length >= 2);

    let doc = {
      ...state.document,
      sketch,
      objects,
      groups
    };

    if (sketch) {
      const synced = syncDocumentSketch(
        { ...doc, sketchStatus: state.document.sketchStatus },
        { skipSolve: true }
      );
      doc = {
        ...synced.document,
        groups,
        sketchStatus: synced.document.sketchStatus
      };
    } else {
      // Also strip any leftover sketch:* objects
      doc = {
        ...doc,
        objects: doc.objects.filter((o) => !isSketchObjectId(o.id) || !idSet.has(o.id))
      };
    }

    setDoc(dispatch, doc);
    dispatch({ type: "SELECT_OBJECT", payload: null });
    return true;
  },

  /** Delete current selection (multi-select / group aware). */
  deleteSelection(state: AppState, dispatch: React.Dispatch<Action>): boolean {
    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    if (ids.length === 0) return false;
    if (ids.some((id) => id.startsWith("components-box:"))) return this.deleteObjects(state, dispatch, ids);

    // If every selected id belongs to the same group and we have most of the group,
    // delete the full group (avoids half-deleted rects from single-edge delete)
    const g = findGroupContaining(state.document, ids[0]);
    if (g && ids.every((id) => g.memberIds.includes(id))) {
      // If user selected the group (or any subset), delete whole group for simplicity
      // when ≥ half the members are selected OR selection matches primary group click
      if (ids.length >= Math.max(1, Math.ceil(g.memberIds.length / 2)) || ids.length === g.memberIds.length) {
        return this.deleteObjects(state, dispatch, g.memberIds);
      }
    }

    return this.deleteObjects(state, dispatch, ids);
  },

  findGroupContaining,
  listGroups
};

function pruneUnusedPoints(
  sketch: NonNullable<AppState["document"]["sketch"]>
): NonNullable<AppState["document"]["sketch"]> {
  const used = new Set<string>();
  for (const e of Object.values(sketch.entities)) {
    if (e.kind === "line") {
      used.add(e.p1);
      used.add(e.p2);
    } else if (e.kind === "circle") {
      used.add(e.center);
    }
  }
  // Also keep points referenced by constraints
  for (const c of Object.values(sketch.constraints)) {
    if ("pointId" in c && typeof (c as { pointId?: string }).pointId === "string") {
      used.add((c as { pointId: string }).pointId);
    }
    if ("a" in c && typeof (c as { a?: string }).a === "string" && c.type === "coincident") {
      used.add((c as { a: string }).a);
      used.add((c as { b: string }).b);
    }
    if (c.type === "distance") {
      used.add(c.a);
      used.add(c.b);
    }
    if (c.type === "fix") used.add(c.pointId);
  }
  const points: typeof sketch.points = {};
  for (const id of used) {
    if (sketch.points[id]) points[id] = sketch.points[id];
  }
  return { ...sketch, points };
}
