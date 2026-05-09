import { describe, it, expect, vi } from "vitest";
import { executeMaterialCommand } from "./materialCommands";
import type { AppState } from "../../core/state/types";
import type { AutomationProtocolRequest } from "../protocol/types";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";

function buildState(): AppState {
  return {
    document: {
      version: 1,
      units: "mm",
      layers: [
        { id: "layer-a", name: "Cut", visible: true, locked: false, operationId: "op-a" },
        { id: "layer-b", name: "Engrave", visible: true, locked: false, operationId: undefined }
      ],
      objects: []
    },
    camSettings: {
      operations: [
        { id: "op-a", name: "Cut", mode: "line", speed: 1000, power: 50, passes: 1 }
      ]
    },
    materialPresets: [
      { id: "mat-1", name: "3mm Plywood", mode: "line", speed: 600, power: 80, passes: 1 },
      { id: "mat-2", name: "Anodized Al", mode: "fill", speed: 2000, power: 30, passes: 2, lineInterval: 0.1, angle: 0 }
    ],
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

describe("material.list", () => {
  it("returns every preset", () => {
    const state = buildState();
    const response = executeMaterialCommand("material.list", { getState: () => state, dispatch: () => {} }, req("material.list"));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toEqual({
      materials: [
        { id: "mat-1", name: "3mm Plywood", mode: "line", speed: 600, power: 80, passes: 1 },
        { id: "mat-2", name: "Anodized Al", mode: "fill", speed: 2000, power: 30, passes: 2, lineInterval: 0.1, angle: 0 }
      ]
    });
  });
});

describe("material.applyToLayer", () => {
  it("copies preset fields onto the layer's linked operation, including mode", () => {
    const state = buildState();
    const actions: any[] = [];
    const response = executeMaterialCommand("material.applyToLayer", {
      getState: () => state,
      dispatch: (a) => actions.push(a)
    }, req("material.applyToLayer", { material: "mat-2", layer: "layer-a" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const data = response.data as any;
    expect(data.layerId).toBe("layer-a");
    expect(data.operationId).toBe("op-a");
    expect(data.applied).toEqual({
      mode: "fill", speed: 2000, power: 30, passes: 2, lineInterval: 0.1, angle: 0
    });
    const setCam = actions.find((a) => a.type === "SET_CAM_SETTINGS");
    expect(setCam.payload.operations.find((o: any) => o.id === "op-a").mode).toBe("fill");
  });

  it("auto-creates an Operation when the layer has no operationId", () => {
    const state = buildState();
    const actions: any[] = [];
    const response = executeMaterialCommand("material.applyToLayer", {
      getState: () => state,
      dispatch: (a) => actions.push(a)
    }, req("material.applyToLayer", { material: "mat-1", layer: "layer-b" }));
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const data = response.data as any;
    expect(data.layerId).toBe("layer-b");
    expect(typeof data.operationId).toBe("string");
    // SET_DOCUMENT links the layer to the new op id
    const setDoc = actions.find((a) => a.type === "SET_DOCUMENT");
    expect(setDoc.payload.layers.find((l: any) => l.id === "layer-b").operationId).toBe(data.operationId);
    // ADD_OPERATION populates from preset
    const addOp = actions.find((a) => a.type === "ADD_OPERATION");
    expect(addOp.payload.id).toBe(data.operationId);
    expect(addOp.payload.mode).toBe("line");
    expect(addOp.payload.speed).toBe(600);
  });

  it("returns MATERIAL_NOT_FOUND for unknown material", () => {
    const state = buildState();
    const response = executeMaterialCommand("material.applyToLayer", { getState: () => state, dispatch: () => {} }, req("material.applyToLayer", { material: "ghost", layer: "layer-a" }));
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors[0].code).toBe("MATERIAL_NOT_FOUND");
  });

  it("does NOT touch activeMaterialPresetId", () => {
    const state = buildState();
    const actions: any[] = [];
    executeMaterialCommand("material.applyToLayer", { getState: () => state, dispatch: (a) => actions.push(a) }, req("material.applyToLayer", { material: "mat-1", layer: "layer-a" }));
    expect(actions.some((a) => a.type === "SET_ACTIVE_MATERIAL_PRESET")).toBe(false);
  });
});
