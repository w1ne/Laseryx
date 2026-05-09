import { describe, expect, it, vi } from "vitest";
import { INITIAL_STATE, type AppState } from "../../core/state/types";
import type { Action } from "../../core/state/actions";
import { appReducer } from "../../core/state/reducer";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import { createLiveCommandExecutor } from "./liveCommands";
import type { ProjectCommandRepo } from "./projectCommands";

function createHarness(initialState: AppState = structuredClone(INITIAL_STATE), projectRepo?: ProjectCommandRepo) {
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
    setDesignPanel,
    projectRepo
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

  it("previews CAM operation updates without mutating state", () => {
    const { executor, getState, dispatch } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-cam-dry",
      command: "cam.setOperation",
      args: {
        operation: "op-1",
        power: 65,
        speed: 1200,
        dryRun: true
      }
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      dryRun: true,
      changed: false,
      operation: {
        id: "op-1",
        power: 65,
        speed: 1200
      }
    });
    expect(getState().camSettings.operations[0]).toMatchObject({
      id: "op-1",
      power: 80,
      speed: 1000
    });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_CAM_SETTINGS" }));
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

  it("adds a rectangle object to an existing layer", () => {
    const { executor, getState } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-add-rect",
      command: "document.addRect",
      args: {
        object: "rect-agent-1",
        layer: "layer-1",
        x: 12,
        y: 18,
        width: 40,
        height: 25
      }
    });

    expect(response.ok).toBe(true);
    expect(response.command).toBe("document.addRect");
    expect(getState().selectedObjectId).toBe("rect-agent-1");
    expect(getState().document.objects[0]).toEqual({
      kind: "shape",
      id: "rect-agent-1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 12, f: 18 },
      shape: { type: "rect", width: 40, height: 25 }
    });
    expect(response.data).toMatchObject({
      object: {
        id: "rect-agent-1",
        layerId: "layer-1",
        shape: { type: "rect", width: 40, height: 25 }
      }
    });
  });

  it("updates transform fields without replacing the whole object", () => {
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

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-transform",
      command: "document.updateObjectTransform",
      args: {
        object: "rect-1",
        x: 42,
        y: 11,
        scaleX: 2
      }
    });

    expect(response.ok).toBe(true);
    expect(getState().document.objects[0]).toMatchObject({
      id: "rect-1",
      layerId: "layer-1",
      transform: { a: 2, b: 0, c: 0, d: 1, e: 42, f: 11 },
      shape: { type: "rect", width: 30, height: 40 }
    });
  });

  it("previews transform updates without mutating state", () => {
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
    const { executor, getState, dispatch } = createHarness(state);

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-transform-dry",
      command: "document.updateObjectTransform",
      args: {
        object: "rect-1",
        x: 42,
        y: 11,
        dryRun: true
      }
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      dryRun: true,
      changed: false,
      object: {
        id: "rect-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e: 42, f: 11 }
      }
    });
    expect(getState().document.objects[0].transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "UPDATE_OBJECT" }));
  });

  it("returns a cloned object for transform dry-run previews", () => {
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

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-transform-dry-clone",
      command: "document.updateObjectTransform",
      args: {
        object: "rect-1",
        x: 42,
        dryRun: true
      }
    });

    if (!response.ok || !response.data || !("object" in response.data) || response.data.object.kind !== "shape") {
      throw new Error("Expected dry-run shape object response");
    }
    response.data.object.shape.width = 99;

    const object = getState().document.objects[0];
    expect(object.kind).toBe("shape");
    if (object.kind !== "shape") throw new Error("Expected state shape object");
    expect(object.shape.width).toBe(30);
  });

  it("moves and deletes document objects", () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.layers.push({ id: "layer-2", name: "Layer 2", visible: true, locked: false, operationId: "op-1" });
    state.document.objects = [
      {
        kind: "shape",
        id: "rect-1",
        layerId: "layer-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
        shape: { type: "rect", width: 30, height: 40 }
      }
    ];
    state.selectedObjectId = "rect-1";
    const { executor, getState } = createHarness(state);

    const moveResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-layer",
      command: "document.setObjectLayer",
      args: { object: "rect-1", layer: "layer-2" }
    });
    const deleteResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-delete",
      command: "document.deleteObject",
      args: { object: "rect-1" }
    });

    expect(moveResponse.ok).toBe(true);
    expect(moveResponse.data).toMatchObject({ object: { id: "rect-1", layerId: "layer-2" } });
    expect(deleteResponse.ok).toBe(true);
    expect(getState().document.objects).toEqual([]);
    expect(getState().selectedObjectId).toBeNull();
  });

  it("previews object deletion without mutating state", () => {
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
    state.selectedObjectId = "rect-1";
    const { executor, getState, dispatch } = createHarness(state);

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-delete-dry",
      command: "document.deleteObject",
      args: { object: "rect-1", dryRun: true }
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      dryRun: true,
      changed: false,
      selectedObjectId: null
    });
    expect(getState().document.objects).toHaveLength(1);
    expect(getState().selectedObjectId).toBe("rect-1");
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "DELETE_OBJECT" }));
  });

  it("rejects invalid document mutations", () => {
    const { executor, getState } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-bad-rect",
      command: "document.addRect",
      args: {
        object: "bad-rect",
        layer: "layer-1",
        width: 0,
        height: 25
      }
    });

    expect(response.ok).toBe(false);
    expect(response.errors[0]).toMatchObject({
      code: "INVALID_DOCUMENT_MUTATION",
      message: "width must be greater than 0"
    });
    expect(getState().document.objects).toEqual([]);
  });

  it("requires rectangle dimensions for document mutations", () => {
    const { executor, getState } = createHarness();

    const response = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-missing-width",
      command: "document.addRect",
      args: {
        object: "bad-rect",
        layer: "layer-1",
        height: 25
      }
    });

    expect(response.ok).toBe(false);
    expect(response.errors[0]).toMatchObject({
      code: "INVALID_DOCUMENT_MUTATION",
      message: "Missing width"
    });
    expect(getState().document.objects).toEqual([]);
  });

  it("rejects duplicate object ids and missing layers", () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.objects = [
      {
        kind: "shape",
        id: "rect-1",
        layerId: "layer-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        shape: { type: "rect", width: 10, height: 10 }
      }
    ];
    const { executor, getState } = createHarness(state);

    const duplicateResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-duplicate",
      command: "document.addRect",
      args: { object: "rect-1", layer: "layer-1", width: 20, height: 20 }
    });
    const missingLayerResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-missing-layer",
      command: "document.addRect",
      args: { object: "rect-2", layer: "missing-layer", width: 20, height: 20 }
    });

    expect(duplicateResponse.ok).toBe(false);
    expect(duplicateResponse.errors[0]).toMatchObject({
      code: "ALREADY_EXISTS",
      message: "Object already exists: rect-1"
    });
    expect(missingLayerResponse.ok).toBe(false);
    expect(missingLayerResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Layer not found: missing-layer"
    });
    expect(getState().document.objects).toHaveLength(1);
  });

  it("rejects transform updates for missing objects, invalid numbers, and empty patches", () => {
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

    const missingResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-missing-object",
      command: "document.updateObjectTransform",
      args: { object: "missing-object", x: 12 }
    });
    const invalidNumberResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-invalid-transform",
      command: "document.updateObjectTransform",
      args: { object: "rect-1", x: "not-a-number" }
    });
    const emptyPatchResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-empty-transform",
      command: "document.updateObjectTransform",
      args: { object: "rect-1" }
    });

    expect(missingResponse.ok).toBe(false);
    expect(missingResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Object not found: missing-object"
    });
    expect(invalidNumberResponse.ok).toBe(false);
    expect(invalidNumberResponse.errors[0]).toMatchObject({
      code: "INVALID_DOCUMENT_MUTATION",
      message: "x must be a number"
    });
    expect(emptyPatchResponse.ok).toBe(false);
    expect(emptyPatchResponse.errors[0]).toMatchObject({
      code: "INVALID_DOCUMENT_MUTATION",
      message: "At least one transform field is required"
    });
    expect(getState().document.objects[0].transform).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
  });

  it("rejects layer moves and deletes for missing objects or layers", () => {
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

    const missingLayerResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-move-missing-layer",
      command: "document.setObjectLayer",
      args: { object: "rect-1", layer: "missing-layer" }
    });
    const missingMoveObjectResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-move-missing-object",
      command: "document.setObjectLayer",
      args: { object: "missing-object", layer: "layer-1" }
    });
    const missingDeleteObjectResponse = executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-delete-missing-object",
      command: "document.deleteObject",
      args: { object: "missing-object" }
    });

    expect(missingLayerResponse.ok).toBe(false);
    expect(missingLayerResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Layer not found: missing-layer"
    });
    expect(missingMoveObjectResponse.ok).toBe(false);
    expect(missingMoveObjectResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Object not found: missing-object"
    });
    expect(missingDeleteObjectResponse.ok).toBe(false);
    expect(missingDeleteObjectResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Object not found: missing-object"
    });
    expect(getState().document.objects).toHaveLength(1);
  });

  it("routes project lifecycle commands through the live executor", async () => {
    const projectRepo: ProjectCommandRepo = {
      list: async () => [{ id: "project-1", name: "Project 1", updatedAt: 123 }],
      load: async () => null,
      save: async () => "project-1",
      delete: async () => undefined
    };
    const { executor } = createHarness(structuredClone(INITIAL_STATE), projectRepo);

    const response = await executor.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-project-list",
      command: "project.list",
      args: {}
    });

    expect(response.ok).toBe(true);
    expect(response.command).toBe("project.list");
    expect(response.data).toEqual({
      projects: [{ id: "project-1", name: "Project 1", updatedAt: 123 }]
    });
  });

  describe("liveCommands routes layer.* to executeLayerCommand", () => {
    it("returns a populated layer.list response", () => {
      const { executor } = createHarness();

      const response = executor.request({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: "test-list",
        command: "layer.list",
        args: {}
      });

      expect(response.ok).toBe(true);
    });
  });
});
