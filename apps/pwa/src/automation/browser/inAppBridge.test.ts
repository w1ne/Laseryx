import { describe, expect, it, vi } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import type { AgentJobInput } from "../types";
import { createInAppAutomationBridge } from "./inAppBridge";
import { createLiveCommandExecutor } from "./liveCommands";
import { createBrowserAutomation, installBrowserAutomation } from "./browserAutomation";
import { INITIAL_STATE, type AppState } from "../../core/state/types";
import type { Action } from "../../core/state/actions";
import { appReducer } from "../../core/state/reducer";

const job = minimalJob as AgentJobInput;

describe("in-app automation bridge", () => {
  it("handles protocol requests against the live job provider", () => {
    const bridge = createInAppAutomationBridge(() => job);
    const response = bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-1",
      command: "inspect",
      args: {}
    });

    expect(response.ok).toBe(true);
    expect(response.requestId).toBe("req-1");
    expect(response.data?.summary.document.objectCount).toBe(1);
  });

  it("uses the latest job provider value for each request", () => {
    let currentJob = job;
    const bridge = createInAppAutomationBridge(() => currentJob);
    const emptyJob = {
      ...job,
      document: {
        ...job.document,
        objects: []
      }
    };

    currentJob = emptyJob;
    const response = bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-2",
      command: "inspect",
      args: {}
    });

    expect(response.ok).toBe(true);
    expect(response.data?.summary.document.objectCount).toBe(0);
  });

  it("exposes protocol beside convenience browser methods", () => {
    const api = createBrowserAutomation(() => job);

    expect(api.protocol.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-3",
      command: "preflight",
      args: {}
    }).ok).toBe(true);
    expect(api.inspect().ok).toBe(true);
  });

  it("installs protocol on the browser global", () => {
    const target: { laseryx?: unknown } = {};
    const cleanup = installBrowserAutomation(() => job, target);

    expect(target.laseryx).toHaveProperty("protocol");
    cleanup();
    expect(target.laseryx).toBeUndefined();
  });

  it("routes live commands through the live executor", () => {
    let state: AppState = structuredClone(INITIAL_STATE);
    const liveExecutor = createLiveCommandExecutor({
      getState: () => state,
      dispatch: (action: Action) => {
        state = appReducer(state, action);
      },
      setPreviewMode: () => undefined,
      setDesignPanel: () => undefined
    });
    const bridge = createInAppAutomationBridge(() => job, liveExecutor);

    const response = bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-live",
      command: "cam.setOperation",
      args: { operation: "op-1", power: 55 }
    });

    expect(response.ok).toBe(true);
    expect(state.camSettings.operations[0].power).toBe(55);
  });

  it("routes document mutation commands through the live executor", () => {
    let state: AppState = structuredClone(INITIAL_STATE);
    const liveExecutor = createLiveCommandExecutor({
      getState: () => state,
      dispatch: (action: Action) => {
        state = appReducer(state, action);
      },
      setPreviewMode: () => undefined,
      setDesignPanel: () => undefined
    });
    const bridge = createInAppAutomationBridge(() => job, liveExecutor);

    const response = bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-live-doc",
      command: "document.addRect",
      args: { object: "bridge-rect", layer: "layer-1", width: 18, height: 12 }
    });

    expect(response.ok).toBe(true);
    expect(state.document.objects[0]).toMatchObject({
      id: "bridge-rect",
      layerId: "layer-1",
      shape: { type: "rect", width: 18, height: 12 }
    });
  });

  it("routes async project lifecycle commands through the live executor", async () => {
    const bridge = createInAppAutomationBridge(() => job, {
      request: async (request) => ({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        command: "project.list",
        data: { projects: [] },
        warnings: [],
        errors: []
      })
    });

    const response = await bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-live-project",
      command: "project.list",
      args: {}
    });

    expect(response.ok).toBe(true);
    expect(response.command).toBe("project.list");
    expect(response.data).toEqual({ projects: [] });
  });

  it("routes project summary through the live executor", async () => {
    const bridge = createInAppAutomationBridge(() => job, {
      request: async (request) => ({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        command: "project.summary",
        data: {
          jobSummary: {
            document: { objectCount: 0 },
            cam: { operationCount: 1 },
            machine: { id: "default-machine" }
          }
        },
        warnings: [],
        errors: []
      })
    });

    const response = await bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-live-project-summary",
      command: "project.summary",
      args: {}
    });

    expect(response.ok).toBe(true);
    expect(response.command).toBe("project.summary");
    expect(response.data).toEqual({
      jobSummary: {
        document: { objectCount: 0 },
        cam: { operationCount: 1 },
        machine: { id: "default-machine" }
      }
    });
  });

  it("delegates layer.create and material.applyToLayer to the live bridge", () => {
    const liveExecutor = {
      request: vi.fn(() => ({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: "x",
        ok: true,
        command: "layer.create",
        data: { id: "layer-x", operationId: "op-x" },
        errors: [],
        warnings: []
      } as never))
    };
    const bridge = createInAppAutomationBridge(() => job, liveExecutor);
    const response = bridge.request({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "x",
      command: "layer.create",
      args: {}
    });
    expect(liveExecutor.request).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });
});
