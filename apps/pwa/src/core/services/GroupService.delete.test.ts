import { describe, expect, it, vi } from "vitest";
import { INITIAL_STATE, type AppState } from "../state/types";
import { GroupService } from "./GroupService";
import { SketchService } from "./SketchService";
import type { Action } from "../state/actions";

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
      state = {
        ...state,
        selectedObjectIds: action.payload,
        selectedObjectId: action.payload[action.payload.length - 1] ?? null
      };
    }
  });
  return { getState: () => state, dispatch, setState: (s: AppState) => (state = s) };
}

describe("GroupService.deleteObjects", () => {
  it("removes sketch lines and clears selection", () => {
    const { getState, dispatch } = harness();
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 0 }, { x: 20, y: 0 });
    SketchService.drawLine(getState(), dispatch, { x: 0, y: 10 }, { x: 20, y: 10 });
    expect(getState().document.objects.filter((o) => o.id.startsWith("sketch:")).length).toBe(2);

    const id = getState().document.objects.find((o) => o.id.startsWith("sketch:"))!.id;
    GroupService.deleteObjects(getState(), dispatch, [id]);
    expect(getState().document.objects.filter((o) => o.id.startsWith("sketch:")).length).toBe(1);
    expect(getState().selectedObjectId).toBeNull();
  });

  it("deletes a rect group entirely", () => {
    const { getState, dispatch } = harness();
    SketchService.drawRect(getState(), dispatch, { x: 0, y: 0, w: 40, h: 20 });
    expect(getState().document.groups?.length).toBe(1);
    expect(getState().document.objects.filter((o) => o.id.startsWith("sketch:")).length).toBe(4);

    const gid = getState().document.groups![0].id;
    GroupService.deleteGroup(getState(), dispatch, gid);
    expect(getState().document.groups ?? []).toHaveLength(0);
    expect(getState().document.objects.filter((o) => o.id.startsWith("sketch:")).length).toBe(0);
  });

  it("deleteSelection removes multi-selected free rects", () => {
    const { getState, dispatch, setState } = harness();
    // free shapes via document inject
    const a = {
      kind: "shape" as const,
      id: "s1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      shape: { type: "rect" as const, width: 10, height: 10 },
      name: "Rect 1"
    };
    const b = {
      kind: "shape" as const,
      id: "s2",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 0 },
      shape: { type: "rect" as const, width: 10, height: 10 },
      name: "Rect 2"
    };
    setState({
      ...getState(),
      document: { ...getState().document, objects: [a, b] },
      selectedObjectIds: ["s1", "s2"],
      selectedObjectId: "s2"
    });
    GroupService.deleteSelection(getState(), dispatch);
    expect(getState().document.objects).toHaveLength(0);
  });
});
