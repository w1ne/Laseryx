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
    const actions: any[] = [];
    const dispatch = (a: any) => actions.push(a);
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
    const actions: any[] = [];
    const response = executeLayerCommand("layer.create", { getState: () => state, dispatch: (a) => actions.push(a) }, req("layer.create"));
    expect(response.ok).toBe(true);
    const addLayer = actions.find((a) => a.type === "ADD_LAYER");
    expect(addLayer.payload.name).toBe("Layer 4");
  });
});
