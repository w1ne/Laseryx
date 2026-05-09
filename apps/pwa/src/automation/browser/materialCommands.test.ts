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
