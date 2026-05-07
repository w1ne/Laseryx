import { describe, expect, it, vi } from "vitest";
import { INITIAL_STATE, type AppState } from "../../core/state/types";
import type { Action } from "../../core/state/actions";
import { appReducer } from "../../core/state/reducer";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import { createLiveCommandExecutor } from "./liveCommands";

function createHarness(initialState: AppState = structuredClone(INITIAL_STATE)) {
  let state = initialState;
  const dispatch = vi.fn((action: Action) => {
    state = appReducer(state, action);
  });
  const setPreviewMode = vi.fn();
  const setDesignPanel = vi.fn();
  const executor = createLiveCommandExecutor({
    getState: () => state,
    dispatch,
    setPreviewMode,
    setDesignPanel
  });
  return { executor, dispatch, setPreviewMode, setDesignPanel, getState: () => state };
}

describe("liveCommands", () => {
  it("updates CAM operation fields", () => {
    const { executor, getState } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-cam",
      command: "cam.setOperation",
      args: {
        operation: "op-1",
        power: 65,
        speed: 1200,
        passes: 2,
        mode: "fill"
      }
    });

    expect(response.ok).toBe(true);
    expect(response.command).toBe("cam.setOperation");
    expect(getState().camSettings.operations[0]).toMatchObject({
      id: "op-1",
      power: 65,
      speed: 1200,
      passes: 2,
      mode: "fill"
    });
    expect(response.data).toMatchObject({
      operation: {
        id: "op-1",
        power: 65,
        speed: 1200,
        passes: 2,
        mode: "fill"
      }
    });
  });

  it("rejects invalid CAM values", () => {
    const { executor, getState } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-cam-bad",
      command: "cam.setOperation",
      args: {
        operation: "op-1",
        power: 150
      }
    });

    expect(response.ok).toBe(false);
    expect(response.errors[0]).toMatchObject({
      code: "INVALID_CAM_VALUE",
      message: "power must be between 0 and 100"
    });
    expect(getState().camSettings.operations[0].power).toBe(80);
  });

  it("sets live UI state through callbacks and store dispatch", () => {
    const { executor, setPreviewMode, setDesignPanel, getState } = createHarness();

    expect(executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-tab",
      command: "ui.setActiveTab",
      args: { tab: "machine" }
    }).ok).toBe(true);
    expect(executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-preview",
      command: "ui.setPreviewMode",
      args: { mode: "gcode" }
    }).ok).toBe(true);
    expect(executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-panel",
      command: "ui.selectDesignPanel",
      args: { panel: "layers" }
    }).ok).toBe(true);

    expect(getState().ui.activeTab).toBe("machine");
    expect(setPreviewMode).toHaveBeenCalledWith("gcode");
    expect(setDesignPanel).toHaveBeenCalledWith("layers");
  });

  it("lists and selects document objects", () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.objects = [
      {
        kind: "shape",
        id: "rect-1",
        layerId: "layer-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
        shape: { type: "rect", width: 30, height: 40 }
      }
    ];
    const { executor, getState } = createHarness(state);

    const listResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-list",
      command: "document.listObjects",
      args: {}
    });
    const selectResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-select",
      command: "document.selectObject",
      args: { object: "rect-1" }
    });

    expect(listResponse.ok).toBe(true);
    expect(listResponse.data).toEqual({
      objects: [
        {
          id: "rect-1",
          kind: "shape",
          layerId: "layer-1"
        }
      ],
      selectedObjectId: null
    });
    expect(selectResponse.ok).toBe(true);
    expect(getState().selectedObjectId).toBe("rect-1");
  });
});
