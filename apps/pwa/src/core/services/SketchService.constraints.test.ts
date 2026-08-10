import { describe, expect, it, vi } from "vitest";
import { INITIAL_STATE, type AppState } from "../state/types";
import { SketchService } from "./SketchService";
import type { Action } from "../state/actions";
import { entityIdFromObjectId } from "../sketch/bake";

function harness() {
  let state: AppState = {
    ...structuredClone(INITIAL_STATE),
    selectedObjectIds: []
  };
  const dispatch = vi.fn((action: Action) => {
    if (action.type === "SET_DOCUMENT") {
      state = { ...state, document: action.payload };
    }
    if (action.type === "SELECT_OBJECT") {
      state = {
        ...state,
        selectedObjectId: action.payload,
        selectedObjectIds: action.payload ? [action.payload] : []
      };
    }
    if (action.type === "SET_SELECTION") {
      const selectedObjectIds = action.payload;
      state = {
        ...state,
        selectedObjectIds,
        selectedObjectId:
          selectedObjectIds.length > 0
            ? selectedObjectIds[selectedObjectIds.length - 1]
            : null
      };
    }
  });
  return {
    getState: () => state,
    dispatch,
    setSelection: (ids: string[]) => {
      state = {
        ...state,
        selectedObjectIds: ids,
        selectedObjectId: ids[ids.length - 1] ?? null
      };
    }
  };
}

describe("SketchService multi-select constraints + snap coincident", () => {
  it("applies perpendicular using two selected lines", () => {
    const { getState, dispatch, setSelection } = harness();
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 0 }, { x: 40, y: 0 });
    SketchService.drawLine(getState(), dispatch, { x: 40, y: 0 }, { x: 50, y: 30 });
    const objs = getState().document.objects.filter((o) => o.id.startsWith("sketch:"));
    expect(objs.length).toBeGreaterThanOrEqual(2);
    setSelection([objs[0].id, objs[1].id]);
    const ok = SketchService.applyConstraintType(getState(), dispatch, "perpendicular");
    expect(ok).toBe(true);
    const types = Object.values(getState().document.sketch!.constraints).map((c) => c.type);
    expect(types).toContain("perpendicular");
  });

  it("creates coincident when drawing with coincidentEnd", () => {
    const { getState, dispatch } = harness();
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 0 }, { x: 30, y: 0 });
    const first = Object.values(getState().document.sketch!.entities).find((e) => e.kind === "line");
    expect(first && first.kind === "line").toBe(true);
    if (!first || first.kind !== "line") return;
    const endId = first.p2;
    SketchService.drawLine(getState(), dispatch, { x: 30, y: 0 }, { x: 60, y: 20 }, {
      coincidentStart: endId
    });
    const coins = Object.values(getState().document.sketch!.constraints).filter(
      (c) => c.type === "coincident"
    );
    expect(coins.length).toBeGreaterThanOrEqual(1);
  });

  it("moves sketch endpoint and keeps length dim updated", () => {
    const { getState, dispatch } = harness();
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 0 }, { x: 40, y: 0 });
    const line = Object.values(getState().document.sketch!.entities).find((e) => e.kind === "line");
    if (!line || line.kind !== "line") throw new Error("no line");
    const p2 = line.p2;
    SketchService.moveSketchPoint(getState(), dispatch, p2, 55, 0);
    const pt = getState().document.sketch!.points[p2];
    expect(pt.x).toBeCloseTo(55, 0);
    const lenC = Object.values(getState().document.sketch!.constraints).find(
      (c) => c.type === "length" && c.lineId === line.id
    );
    expect(lenC && lenC.type === "length" && lenC.value.kind === "literal").toBe(true);
    if (lenC && lenC.type === "length" && lenC.value.kind === "literal") {
      expect(lenC.value.value).toBeCloseTo(55, 0);
    }
    void entityIdFromObjectId;
  });
});
