import { describe, it, expect, vi } from "vitest";
import { executeLayerCommand } from "./layerCommands";
import type { AppState } from "../../core/state/types";
import type { AutomationProtocolRequest } from "../protocol/types";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";

function buildState(): AppState {
  // Two layers, one duplicate name to exercise ambiguity
  return {
    document: {
      version: 1,
      units: "mm",
      layers: [
        { id: "layer-a", name: "Cut", visible: true, locked: false, operationId: "op-a" },
        { id: "layer-b", name: "Engrave", visible: true, locked: false, operationId: "op-b" },
        { id: "layer-c", name: "Cut", visible: true, locked: false, operationId: "op-c" }
      ],
      objects: []
    },
    camSettings: {
      operations: [
        { id: "op-a", name: "Cut", mode: "line", speed: 1000, power: 50, passes: 1 },
        { id: "op-b", name: "Engrave", mode: "fill", speed: 600, power: 30, passes: 1 },
        { id: "op-c", name: "Cut2", mode: "line", speed: 1000, power: 50, passes: 1 }
      ]
    },
    materialPresets: [],
    activeMaterialPresetId: null,
    selectedObjectId: null,
    ui: { activeTab: "design" }
  } as unknown as AppState;
}

function req(command: string, args: Record<string, unknown> = {}): AutomationProtocolRequest {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: "test-1",
    command: command as AutomationProtocolRequest["command"],
    args
  };
}

describe("layer.list", () => {
  it("returns id, name, visibility, lock, operationId, and objectCount for each layer", () => {
    const state = buildState();
    state.document.objects = [
      { kind: "shape", id: "obj-1", layerId: "layer-a", transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, shape: { type: "rect", width: 10, height: 10 } } as never
    ];
    const dispatch = vi.fn();
    const response = executeLayerCommand("layer.list", { getState: () => state, dispatch }, req("layer.list"));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({
      layers: [
        { id: "layer-a", name: "Cut", visible: true, locked: false, operationId: "op-a", objectCount: 1 },
        { id: "layer-b", name: "Engrave", visible: true, locked: false, operationId: "op-b", objectCount: 0 },
        { id: "layer-c", name: "Cut", visible: true, locked: false, operationId: "op-c", objectCount: 0 }
      ]
    });
  });
});

describe("layer.create", () => {
  it("dispatches ADD_LAYER and ADD_OPERATION and returns the new ids", () => {
    const state = buildState();
    const actions: Action[] = [];
    const dispatch = (a: Action) => actions.push(a);
    const response = executeLayerCommand("layer.create", { getState: () => state, dispatch }, req("layer.create", { name: "Score" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const addLayer = actions.find((a) => a.type === "ADD_LAYER");
    const addOp = actions.find((a) => a.type === "ADD_OPERATION");
    expect(addLayer).toBeDefined();
    expect(addOp).toBeDefined();
    expect(addLayer.payload.name).toBe("Score");
    expect(addLayer.payload.operationId).toBe(addOp.payload.id);
    expect(response.data).toEqual({ id: addLayer.payload.id, operationId: addOp.payload.id });
  });

  it("defaults the name to Layer N when name is omitted", () => {
    const state = buildState(); // 3 existing layers
    const actions: Action[] = [];
    const response = executeLayerCommand("layer.create", { getState: () => state, dispatch: (a: Action) => actions.push(a) }, req("layer.create"));
    expect(response.ok).toBe(true);
    const addLayer = actions.find((a) => a.type === "ADD_LAYER");
    expect(addLayer.payload.name).toBe("Layer 4");
  });
});

describe("layer.rename", () => {
  it("renames the resolved layer by id", () => {
    const state = buildState();
    const actions: Action[] = [];
    const response = executeLayerCommand("layer.rename", { getState: () => state, dispatch: (a: Action) => actions.push(a) }, req("layer.rename", { layer: "layer-b", name: "EngraveDeep" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({ id: "layer-b", name: "EngraveDeep" });
    const setDoc = actions.find((a) => a.type === "SET_DOCUMENT");
    expect(setDoc).toBeDefined();
    const renamed = setDoc.payload.layers.find((l) => l.id === "layer-b");
    expect(renamed.name).toBe("EngraveDeep");
  });

  it("returns LAYER_AMBIGUOUS when name matches multiple layers", () => {
    const state = buildState();
    const response = executeLayerCommand("layer.rename", { getState: () => state, dispatch: () => {} }, req("layer.rename", { layer: "Cut", name: "X" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("LAYER_AMBIGUOUS");
  });

  it("returns LAYER_NOT_FOUND when no layer matches", () => {
    const state = buildState();
    const response = executeLayerCommand("layer.rename", { getState: () => state, dispatch: () => {} }, req("layer.rename", { layer: "ghost", name: "X" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("LAYER_NOT_FOUND");
  });
});

describe("layer.delete", () => {
  it("deletes a free layer", () => {
    const state = buildState();
    const actions: Action[] = [];
    const response = executeLayerCommand("layer.delete", { getState: () => state, dispatch: (a: Action) => actions.push(a) }, req("layer.delete", { layer: "layer-b" }));
    expect(response.ok).toBe(true);
    expect(actions).toContainEqual({ type: "DELETE_LAYER", payload: "layer-b" });
  });

  it("returns LAYER_HAS_OBJECTS when layer holds objects", () => {
    const state = buildState();
    state.document.objects = [
      { kind: "shape", id: "obj-1", layerId: "layer-b", transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, shape: { type: "rect", width: 10, height: 10 } } as never
    ];
    const response = executeLayerCommand("layer.delete", { getState: () => state, dispatch: () => {} }, req("layer.delete", { layer: "layer-b" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("LAYER_HAS_OBJECTS");
  });

  it("returns LAYER_LAST when only one layer exists", () => {
    const state = buildState();
    state.document.layers = [state.document.layers[0]];
    const response = executeLayerCommand("layer.delete", { getState: () => state, dispatch: () => {} }, req("layer.delete", { layer: "layer-a" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("LAYER_LAST");
  });
});

describe("layer.setVisibility / setLock", () => {
  it("sets visibility to false", () => {
    const state = buildState();
    const actions: Action[] = [];
    const response = executeLayerCommand("layer.setVisibility", { getState: () => state, dispatch: (a: Action) => actions.push(a) }, req("layer.setVisibility", { layer: "layer-a", visible: false }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({ id: "layer-a", visible: false });
    const setDoc = actions.find((a) => a.type === "SET_DOCUMENT");
    expect(setDoc.payload.layers.find((l) => l.id === "layer-a").visible).toBe(false);
  });

  it("sets lock to true", () => {
    const state = buildState();
    const actions: Action[] = [];
    const response = executeLayerCommand("layer.setLock", { getState: () => state, dispatch: (a: Action) => actions.push(a) }, req("layer.setLock", { layer: "layer-a", locked: true }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({ id: "layer-a", locked: true });
  });

  it("rejects non-boolean visible", () => {
    const state = buildState();
    const response = executeLayerCommand("layer.setVisibility", { getState: () => state, dispatch: () => {} }, req("layer.setVisibility", { layer: "layer-a", visible: "yes" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("INVALID_INPUT");
  });
});

describe("layer.get", () => {
  it("returns the layer summary plus its linked operation fields", () => {
    const state = buildState();
    const response = executeLayerCommand("layer.get", { getState: () => state, dispatch: () => {} }, req("layer.get", { layer: "layer-a" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({
      layer: {
        id: "layer-a",
        name: "Cut",
        visible: true,
        locked: false,
        operationId: "op-a",
        objectCount: 0,
        operation: { mode: "line", speed: 1000, power: 50, passes: 1 }
      }
    });
  });

  it("omits the operation block when the layer has no operationId", () => {
    const state = buildState();
    state.document.layers[0] = { ...state.document.layers[0], operationId: undefined };
    const response = executeLayerCommand("layer.get", { getState: () => state, dispatch: () => {} }, req("layer.get", { layer: "layer-a" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect((response.data as Record<string, unknown>).layer.operation).toBeUndefined();
  });
});
