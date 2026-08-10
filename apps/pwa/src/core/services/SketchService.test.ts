import { describe, expect, it, vi } from "vitest";
import { INITIAL_STATE, type AppState } from "../state/types";
import { SketchService } from "./SketchService";
import type { Action } from "../state/actions";

function harness() {
  let state: AppState = structuredClone(INITIAL_STATE);
  const dispatch = vi.fn((action: Action) => {
    if (action.type === "SET_DOCUMENT") {
      state = { ...state, document: action.payload };
    }
    if (action.type === "SELECT_OBJECT") {
      state = { ...state, selectedObjectId: action.payload };
    }
  });
  const getState = () => state;
  return { getState, dispatch };
}

describe("SketchService", () => {
  it("draws a constrained horizontal line into the document", () => {
    const { getState, dispatch } = harness();
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 10 }, { x: 40, y: 10 });
    const doc = getState().document;
    expect(doc.sketch).toBeTruthy();
    expect(Object.keys(doc.sketch!.entities).length).toBe(1);
    expect(doc.objects.some((o) => o.id.startsWith("sketch:"))).toBe(true);
    expect(doc.sketchStatus?.ok).toBe(true);
  });

  it("draws a rect with H/V constraints and auto-groups as one list item", () => {
    const { getState, dispatch } = harness();
    SketchService.drawRect(getState(), dispatch, { x: 0, y: 0, w: 50, h: 30 });
    const doc = getState().document;
    expect(Object.keys(doc.sketch!.entities).length).toBe(4);
    expect(Object.values(doc.sketch!.constraints).some((c) => c.type === "horizontal")).toBe(true);
    expect(Object.values(doc.sketch!.constraints).some((c) => c.type === "length")).toBe(true);
    // Compact list: one group, not four separate lines
    expect(doc.groups?.length).toBe(1);
    expect(doc.groups![0].memberIds).toHaveLength(4);
    expect(doc.groups![0].name).toMatch(/^Rect /);
  });
});
