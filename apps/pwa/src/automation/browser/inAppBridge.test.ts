import { describe, expect, it } from "vitest";
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
});
