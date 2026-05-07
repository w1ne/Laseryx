import { describe, expect, it, vi } from "vitest";
import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import { INITIAL_STATE } from "../../core/state/types";
import type { CamSettings, Document, MachineProfile } from "../../core/model";
import type { AgentJobInput } from "../types";
import { appReducer } from "../../core/state/reducer";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolRequest } from "../protocol/types";
import { executeProjectCommand, type ProjectCommandRepo } from "./projectCommands";

function createHarness(initialState: AppState = structuredClone(INITIAL_STATE), repo: ProjectCommandRepo = createRepo()) {
  let state = initialState;
  const dispatch = vi.fn((action: Action) => {
    state = appReducer(state, action);
  });
  const request = (command: string, args: Record<string, unknown> = {}) => executeProjectCommand(
    command as never,
    {
      getState: () => state,
      dispatch,
      repo,
      createObjectUrl: (blob) => `blob:${blob.size}`
    },
    {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: `req-${command}`,
      command: command as never,
      args
    } as AutomationProtocolRequest
  );
  return { request, getState: () => state, dispatch, repo };
}

function createRepo(): ProjectCommandRepo {
  const projects = new Map<string, { name: string; document: Document; camSettings?: CamSettings; machineProfile?: MachineProfile; updatedAt: number }>();
  let nextId = 1;
  return {
    async save(document, _assets, name, id, metadata) {
      const projectId = id ?? `project-${nextId++}`;
      projects.set(projectId, {
        name: name ?? "Untitled Project",
        document: structuredClone(document),
        camSettings: metadata?.camSettings ? structuredClone(metadata.camSettings) : undefined,
        machineProfile: metadata?.machineProfile ? structuredClone(metadata.machineProfile) : undefined,
        updatedAt: Date.now()
      });
      return projectId;
    },
    async list() {
      return Array.from(projects.entries()).map(([id, project]) => ({
        id,
        name: project.name,
        updatedAt: project.updatedAt
      }));
    },
    async load(id) {
      const project = projects.get(id);
      return project ? {
        name: project.name,
        document: structuredClone(project.document),
        assets: new Map(),
        camSettings: project.camSettings ? structuredClone(project.camSettings) : undefined,
        machineProfile: project.machineProfile ? structuredClone(project.machineProfile) : undefined
      } : null;
    },
    async delete(id) {
      projects.delete(id);
    }
  };
}

describe("projectCommands", () => {
  it("saves and lists the current project with CAM metadata", async () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.objects = [{
      kind: "shape",
      id: "rect-1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      shape: { type: "rect", width: 30, height: 40 }
    }];
    state.camSettings.operations[0].power = 42;
    const { request } = createHarness(state);

    const saveResponse = await request("project.save", { name: "Agent Project" });
    const listResponse = await request("project.list");

    expect(saveResponse.ok).toBe(true);
    expect(saveResponse.data).toMatchObject({
      project: {
        id: "project-1",
        name: "Agent Project",
        summary: { objectCount: 1, operationCount: 1 }
      }
    });
    expect(listResponse.ok).toBe(true);
    expect(listResponse.data).toMatchObject({
      projects: [{ id: "project-1", name: "Agent Project" }]
    });
  });

  it("opens a saved project and restores document and CAM settings", async () => {
    const { request, getState, dispatch } = createHarness();
    await request("project.save", { id: "saved", name: "Saved" });
    dispatch({
      type: "ADD_OBJECT",
      payload: {
        kind: "shape",
        id: "temp",
        layerId: "layer-1",
        transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        shape: { type: "rect", width: 10, height: 10 }
      }
    });
    dispatch({
      type: "SET_CAM_SETTINGS",
      payload: {
        ...getState().camSettings,
        operations: [{ ...getState().camSettings.operations[0], power: 15 }]
      }
    });

    const response = await request("project.open", { id: "saved" });

    expect(response.ok).toBe(true);
    expect(getState().document.objects).toEqual([]);
    expect(getState().camSettings.operations[0].power).toBe(80);
    expect(getState().selectedObjectId).toBeNull();
  });

  it("creates a new project by resetting document and CAM state", async () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.objects = [{
      kind: "shape",
      id: "rect-1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      shape: { type: "rect", width: 10, height: 10 }
    }];
    state.camSettings.operations[0].power = 25;
    state.selectedObjectId = "rect-1";
    const { request, getState } = createHarness(state);

    const response = await request("project.new");

    expect(response.ok).toBe(true);
    expect(getState().document).toEqual(INITIAL_STATE.document);
    expect(getState().camSettings).toEqual(INITIAL_STATE.camSettings);
    expect(getState().selectedObjectId).toBeNull();
  });

  it("exports and imports a JSON job", async () => {
    const { request, getState } = createHarness();
    const exportResponse = await request("project.exportJson");
    const importedJob = structuredClone((exportResponse.data as { job: AgentJobInput }).job);
    importedJob.document.objects = [{
      kind: "shape",
      id: "imported",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 6 },
      shape: { type: "rect", width: 7, height: 8 }
    }];
    importedJob.camSettings.operations[0].speed = 222;

    const importResponse = await request("project.importJson", { job: importedJob });

    expect(importResponse.ok).toBe(true);
    expect(getState().document.objects[0].id).toBe("imported");
    expect(getState().camSettings.operations[0].speed).toBe(222);
  });

  it("summarizes the current project without exporting the full job", async () => {
    const state = structuredClone(INITIAL_STATE);
    state.document.objects = [{
      kind: "shape",
      id: "rect-1",
      layerId: "layer-1",
      transform: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 6 },
      shape: { type: "rect", width: 7, height: 8 }
    }];
    state.camSettings.operations[0].speed = 222;
    const { request } = createHarness(state);

    const response = await request("project.summary");

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      jobSummary: {
        document: expect.objectContaining({
          objectCount: 1,
          layerCount: 1,
          objectsByKind: { shape: 1, path: 0, image: 0 }
        }),
        cam: expect.objectContaining({
          operationCount: 1,
          operations: [expect.objectContaining({ id: "op-1", speed: 222 })]
        }),
        machine: expect.objectContaining({ id: "default-machine" })
      }
    });
  });

  it("keeps summary stable across export and import round trips", async () => {
    const { request } = createHarness();
    const before = await request("project.summary");
    const exported = await request("project.exportJson");
    const importedJob = structuredClone((exported.data as { job: AgentJobInput }).job);

    await request("project.new");
    const importResponse = await request("project.importJson", { job: importedJob });
    const after = await request("project.summary");

    expect(importResponse.ok).toBe(true);
    expect(after.data).toEqual(before.data);
  });

  it("deletes projects and rejects missing project ids", async () => {
    const { request } = createHarness();
    await request("project.save", { id: "saved", name: "Saved" });

    const missingOpenResponse = await request("project.open", { id: "missing" });
    const deleteResponse = await request("project.delete", { id: "saved" });
    const missingDeleteResponse = await request("project.delete", { id: "saved" });
    const listResponse = await request("project.list");

    expect(missingOpenResponse.ok).toBe(false);
    expect(missingOpenResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found: missing"
    });
    expect(deleteResponse.ok).toBe(true);
    expect(missingDeleteResponse.ok).toBe(false);
    expect(missingDeleteResponse.errors[0]).toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found: saved"
    });
    expect(listResponse.data).toEqual({ projects: [] });
  });

  it("rejects invalid project command input", async () => {
    const { request } = createHarness();

    const saveResponse = await request("project.save", { name: "" });
    const importResponse = await request("project.importJson", { job: { document: {} } });

    expect(saveResponse.ok).toBe(false);
    expect(saveResponse.errors[0]).toMatchObject({
      code: "INVALID_PROJECT_INPUT",
      message: "name must be a non-empty string"
    });
    expect(importResponse.ok).toBe(false);
    expect(importResponse.errors[0]).toMatchObject({
      code: "INVALID_PROJECT_INPUT",
      message: "job.document.version must be 1"
    });
  });

  it("returns specific import validation errors for missing job sections", async () => {
    const { request } = createHarness();
    const exportResponse = await request("project.exportJson");
    const job = structuredClone((exportResponse.data as { job: AgentJobInput }).job) as Record<string, unknown>;
    delete job.machineProfile;

    const response = await request("project.importJson", { job });

    expect(response.ok).toBe(false);
    expect(response.errors[0]).toMatchObject({
      code: "INVALID_PROJECT_INPUT",
      message: "job.machineProfile.id must be a string"
    });
  });
});
