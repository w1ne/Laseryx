import type { Action } from "../../core/state/actions";
import { INITIAL_STATE, type AppState } from "../../core/state/types";
import type { CamSettings, Document, ImageObj, MachineProfile } from "../../core/model";
import { projectRepo, type LoadedProject, type ProjectSaveMetadata, type ProjectSummary } from "../../io/projectRepo";
import { diagnostic, errorResponse, okResponse } from "../responses";
import type { AgentDiagnostic, AgentJobInput } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse
} from "../protocol/types";
import { summarizeJob } from "../summarizeJob";

export type ProjectAutomationCommand =
  | "project.new"
  | "project.save"
  | "project.list"
  | "project.open"
  | "project.delete"
  | "project.exportJson"
  | "project.importJson";

export type ProjectCommandRepo = {
  list: () => Promise<ProjectSummary[]>;
  load: (id: string) => Promise<(LoadedProject & ProjectSaveMetadata) | null>;
  save: (
    document: Document,
    assets: Map<string, Blob>,
    name?: string,
    id?: string,
    metadata?: ProjectSaveMetadata
  ) => Promise<string>;
  delete: (id: string) => Promise<void>;
};

export type ProjectCommandExecutorOptions = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
  repo?: ProjectCommandRepo;
  createObjectUrl?: (blob: Blob) => string;
  fetchAsset?: (url: string) => Promise<Blob>;
};

type ProjectResponseData =
  | { project: ProjectSummary & { summary?: { objectCount: number; operationCount: number } } }
  | { projects: ProjectSummary[] }
  | { job: AgentJobInput }
  | { deletedProjectId: string };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function wrap(
  request: AutomationProtocolRequest,
  response: ReturnType<typeof okResponse<ProjectResponseData>>
): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: request.requestId,
    ...response
  } as AutomationProtocolResponse;
}

function projectInputError(message: string): AgentDiagnostic {
  return diagnostic("INVALID_PROJECT_INPUT", "error", message);
}

function stringArg(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[], required = true): string | undefined {
  const value = args[key];
  if (value === undefined && !required) return undefined;
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  diagnostics.push(projectInputError(`${key} must be a non-empty string`));
  return undefined;
}

function currentJob(state: AppState): AgentJobInput {
  return {
    document: state.document,
    camSettings: state.camSettings,
    machineProfile: state.machineProfile
  };
}

function applyJob(options: ProjectCommandExecutorOptions, job: AgentJobInput): void {
  options.dispatch({ type: "SET_DOCUMENT", payload: job.document });
  options.dispatch({ type: "SET_CAM_SETTINGS", payload: job.camSettings });
  options.dispatch({ type: "SELECT_OBJECT", payload: null });
}

function isJobInput(value: unknown): value is AgentJobInput {
  const record = asRecord(value);
  return asRecord(record.document).version === 1
    && Array.isArray(asRecord(record.document).layers)
    && Array.isArray(asRecord(record.document).objects)
    && Array.isArray(asRecord(record.camSettings).operations)
    && typeof asRecord(record.machineProfile).id === "string";
}

async function collectAssets(document: Document, options: ProjectCommandExecutorOptions): Promise<{ document: Document; assets: Map<string, Blob> }> {
  const docClone = structuredClone(document);
  const assets = new Map<string, Blob>();
  const fetchAsset = options.fetchAsset ?? (async (url: string) => {
    const response = await fetch(url);
    return await response.blob();
  });

  for (const object of docClone.objects) {
    if (object.kind === "image" && object.src.startsWith("blob:")) {
      const blob = await fetchAsset(object.src);
      const assetId = `asset-${object.id}`;
      assets.set(assetId, blob);
      object.src = assetId;
    }
  }

  return { document: docClone, assets };
}

function hydrateLoadedDocument(loaded: LoadedProject, createObjectUrl?: (blob: Blob) => string): Document {
  const document = structuredClone(loaded.document);
  const objectUrl = createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  for (const object of document.objects) {
    if (object.kind === "image") {
      const image = object as ImageObj;
      const blob = loaded.assets.get(image.src);
      if (blob) {
        image.src = objectUrl(blob);
      }
    }
  }
  return document;
}

async function saveProject(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): Promise<AutomationProtocolResponse> {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const name = stringArg(args, "name", diagnostics, false);
  const id = stringArg(args, "id", diagnostics, false);
  if (diagnostics.length > 0) {
    return wrap(request, errorResponse<ProjectResponseData>("project.save", diagnostics));
  }

  const state = options.getState();
  const { document, assets } = await collectAssets(state.document, options);
  const repo = options.repo ?? projectRepo;
  const projectId = await repo.save(document, assets, name, id, {
    camSettings: state.camSettings,
    machineProfile: state.machineProfile
  });
  const summary = summarizeJob({
    document,
    camSettings: state.camSettings,
    machineProfile: state.machineProfile
  });

  return wrap(request, okResponse<ProjectResponseData>("project.save", {
    project: {
      id: projectId,
      name: name ?? "Untitled Project",
      updatedAt: Date.now(),
      summary: {
        objectCount: summary.document.objectCount,
        operationCount: summary.cam.operationCount
      }
    }
  }));
}

async function listProjects(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): Promise<AutomationProtocolResponse> {
  const projects = await (options.repo ?? projectRepo).list();
  return wrap(request, okResponse<ProjectResponseData>("project.list", { projects }));
}

async function openProject(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): Promise<AutomationProtocolResponse> {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const id = stringArg(args, "id", diagnostics);
  if (diagnostics.length > 0) {
    return wrap(request, errorResponse<ProjectResponseData>("project.open", diagnostics));
  }

  const loaded = await (options.repo ?? projectRepo).load(id!);
  if (!loaded) {
    return wrap(request, errorResponse<ProjectResponseData>("project.open", [
      diagnostic("NOT_FOUND", "error", `Project not found: ${id}`)
    ]));
  }

  const job: AgentJobInput = {
    document: hydrateLoadedDocument(loaded, options.createObjectUrl),
    camSettings: loaded.camSettings ?? INITIAL_STATE.camSettings,
    machineProfile: loaded.machineProfile ?? options.getState().machineProfile
  };
  applyJob(options, job);
  return wrap(request, okResponse<ProjectResponseData>("project.open", {
    project: {
      id: id!,
      name: loaded.name,
      updatedAt: Date.now()
    }
  }));
}

async function deleteProject(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): Promise<AutomationProtocolResponse> {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const id = stringArg(args, "id", diagnostics);
  if (diagnostics.length > 0) {
    return wrap(request, errorResponse<ProjectResponseData>("project.delete", diagnostics));
  }

  const repo = options.repo ?? projectRepo;
  const existing = await repo.load(id!);
  if (!existing) {
    return wrap(request, errorResponse<ProjectResponseData>("project.delete", [
      diagnostic("NOT_FOUND", "error", `Project not found: ${id}`)
    ]));
  }

  await repo.delete(id!);
  return wrap(request, okResponse<ProjectResponseData>("project.delete", { deletedProjectId: id! }));
}

function newProject(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  applyJob(options, currentJob(INITIAL_STATE));
  return wrap(request, okResponse<ProjectResponseData>("project.new", { job: currentJob(INITIAL_STATE) }));
}

function exportJson(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  return wrap(request, okResponse<ProjectResponseData>("project.exportJson", { job: structuredClone(currentJob(options.getState())) }));
}

function importJson(options: ProjectCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  if (!isJobInput(args.job)) {
    return wrap(request, errorResponse<ProjectResponseData>("project.importJson", [
      projectInputError("job must include document, camSettings, and machineProfile")
    ]));
  }

  const job = structuredClone(args.job);
  applyJob(options, job);
  return wrap(request, okResponse<ProjectResponseData>("project.importJson", { job }));
}

export async function executeProjectCommand(
  command: ProjectAutomationCommand,
  options: ProjectCommandExecutorOptions,
  request: AutomationProtocolRequest
): Promise<AutomationProtocolResponse> {
  try {
    switch (command) {
      case "project.new":
        return newProject(options, request);
      case "project.save":
        return await saveProject(options, request);
      case "project.list":
        return await listProjects(options, request);
      case "project.open":
        return await openProject(options, request);
      case "project.delete":
        return await deleteProject(options, request);
      case "project.exportJson":
        return exportJson(options, request);
      case "project.importJson":
        return importJson(options, request);
    }
  } catch (error) {
    return wrap(request, errorResponse<ProjectResponseData>(command, [
      diagnostic("PROJECT_COMMAND_FAILED", "error", error instanceof Error ? error.message : String(error))
    ]));
  }
}
