import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import type { Operation, OperationMode } from "../../core/model";
import { diagnostic, errorResponse, okResponse } from "../responses";
import type { AgentDiagnostic } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse,
  type LiveAutomationCommand
} from "../protocol/types";
import { validateProtocolRequest } from "../protocol/validate";
import { executeDocumentCommand } from "./documentCommands";
import { executeProjectCommand, type ProjectCommandRepo } from "./projectCommands";

type PreviewMode = "design" | "gcode";
type DesignPanel = "document" | "properties" | "layers";

export type LiveCommandExecutorOptions = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setDesignPanel: (panel: DesignPanel) => void;
  projectRepo?: ProjectCommandRepo;
};

type LiveResponseData =
  | { operation: Operation }
  | { operation: Operation; dryRun: true; changed: false }
  | { activeTab: AppState["ui"]["activeTab"] }
  | { previewMode: PreviewMode }
  | { designPanel: DesignPanel }
  | { objects: Array<{ id: string; kind: string; layerId: string }>; selectedObjectId: string | null }
  | { selectedObjectId: string | null };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numericArg(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[]): number | undefined {
  if (args[key] === undefined) return undefined;
  const value = Number(args[key]);
  if (!Number.isFinite(value)) {
    diagnostics.push(diagnostic("INVALID_CAM_VALUE", "error", `${key} must be a number`));
    return undefined;
  }
  return value;
}

function validatePositiveInteger(value: number | undefined, key: string, diagnostics: AgentDiagnostic[]): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    diagnostics.push(diagnostic("INVALID_CAM_VALUE", "error", `${key} must be a positive integer`));
  }
}

function validatePositiveNumber(value: number | undefined, key: string, diagnostics: AgentDiagnostic[]): void {
  if (value !== undefined && value <= 0) {
    diagnostics.push(diagnostic("INVALID_CAM_VALUE", "error", `${key} must be greater than 0`));
  }
}

function setOperation(options: LiveCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const operationId = typeof args.operation === "string" ? args.operation : undefined;
  if (!operationId) {
    return wrap(request, errorResponse<LiveResponseData>("cam.setOperation", [
      diagnostic("INVALID_INPUT", "error", "Missing operation")
    ]));
  }

  const state = options.getState();
  const operation = state.camSettings.operations.find((item) => item.id === operationId);
  if (!operation) {
    return wrap(request, errorResponse<LiveResponseData>("cam.setOperation", [
      diagnostic("NOT_FOUND", "error", `Operation not found: ${operationId}`)
    ]));
  }

  const diagnostics: AgentDiagnostic[] = [];
  const speed = numericArg(args, "speed", diagnostics);
  const power = numericArg(args, "power", diagnostics);
  const passes = numericArg(args, "passes", diagnostics);
  const mode = args.mode;

  validatePositiveNumber(speed, "speed", diagnostics);
  validatePositiveInteger(passes, "passes", diagnostics);
  if (power !== undefined && (power < 0 || power > 100)) {
    diagnostics.push(diagnostic("INVALID_CAM_VALUE", "error", "power must be between 0 and 100"));
  }
  if (mode !== undefined && mode !== "line" && mode !== "fill") {
    diagnostics.push(diagnostic("INVALID_CAM_VALUE", "error", "mode must be line or fill"));
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<LiveResponseData>("cam.setOperation", diagnostics));
  }

  const updated: Operation = {
    ...operation,
    ...(speed !== undefined ? { speed } : {}),
    ...(power !== undefined ? { power } : {}),
    ...(passes !== undefined ? { passes } : {}),
    ...(mode !== undefined ? { mode: mode as OperationMode } : {})
  };
  if (args.dryRun === true) {
    return wrap(request, okResponse<LiveResponseData>("cam.setOperation", {
      dryRun: true,
      changed: false,
      operation: updated
    }));
  }
  options.dispatch({
    type: "SET_CAM_SETTINGS",
    payload: {
      ...state.camSettings,
      operations: state.camSettings.operations.map((item) => item.id === operationId ? updated : item)
    }
  });

  return wrap(request, okResponse<LiveResponseData>("cam.setOperation", { operation: updated }));
}

function wrap(request: AutomationProtocolRequest, response: ReturnType<typeof okResponse<LiveResponseData>>): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: request.requestId,
    ...response
  } as AutomationProtocolResponse;
}

export function createLiveCommandExecutor(options: LiveCommandExecutorOptions) {
  return {
    request(input: unknown): AutomationProtocolResponse {
      const validation = validateProtocolRequest(input);
      if (!validation.ok) {
        return {
          protocolVersion: AUTOMATION_PROTOCOL_VERSION,
          requestId: "unknown",
          ...errorResponse<LiveResponseData>("inspect", validation.errors)
        } as AutomationProtocolResponse;
      }

      const request = validation.request;
      const args = asRecord(request.args);
      const command = request.command as LiveAutomationCommand;

      switch (command) {
        case "cam.setOperation":
          return setOperation(options, request);
        case "ui.setActiveTab": {
          if (args.tab !== "design" && args.tab !== "machine") {
            return wrap(request, errorResponse<LiveResponseData>("ui.setActiveTab", [
              diagnostic("INVALID_INPUT", "error", "tab must be design or machine")
            ]));
          }
          options.dispatch({ type: "SET_ACTIVE_TAB", payload: args.tab });
          return wrap(request, okResponse<LiveResponseData>("ui.setActiveTab", { activeTab: args.tab }));
        }
        case "ui.setPreviewMode": {
          if (args.mode !== "design" && args.mode !== "gcode") {
            return wrap(request, errorResponse<LiveResponseData>("ui.setPreviewMode", [
              diagnostic("INVALID_INPUT", "error", "mode must be design or gcode")
            ]));
          }
          options.setPreviewMode(args.mode);
          return wrap(request, okResponse<LiveResponseData>("ui.setPreviewMode", { previewMode: args.mode }));
        }
        case "ui.selectDesignPanel": {
          if (args.panel !== "document" && args.panel !== "properties" && args.panel !== "layers") {
            return wrap(request, errorResponse<LiveResponseData>("ui.selectDesignPanel", [
              diagnostic("INVALID_INPUT", "error", "panel must be document, properties, or layers")
            ]));
          }
          options.setDesignPanel(args.panel);
          return wrap(request, okResponse<LiveResponseData>("ui.selectDesignPanel", { designPanel: args.panel }));
        }
        case "document.listObjects": {
          const state = options.getState();
          return wrap(request, okResponse<LiveResponseData>("document.listObjects", {
            objects: state.document.objects.map((object) => ({
              id: object.id,
              kind: object.kind,
              layerId: object.layerId
            })),
            selectedObjectId: state.selectedObjectId
          }));
        }
        case "document.selectObject": {
          const objectId = typeof args.object === "string" ? args.object : null;
          const state = options.getState();
          if (objectId !== null && !state.document.objects.some((object) => object.id === objectId)) {
            return wrap(request, errorResponse<LiveResponseData>("document.selectObject", [
              diagnostic("NOT_FOUND", "error", `Object not found: ${objectId}`)
            ]));
          }
          options.dispatch({ type: "SELECT_OBJECT", payload: objectId });
          return wrap(request, okResponse<LiveResponseData>("document.selectObject", { selectedObjectId: objectId }));
        }
        case "document.addRect":
        case "document.updateObjectTransform":
        case "document.setObjectLayer":
        case "document.deleteObject":
          return executeDocumentCommand(command, options, request);
        case "project.new":
        case "project.save":
        case "project.list":
        case "project.open":
        case "project.delete":
        case "project.summary":
        case "project.exportJson":
        case "project.importJson":
          return executeProjectCommand(command, { ...options, repo: options.projectRepo }, request);
        default:
          return wrap(request, errorResponse<LiveResponseData>("inspect", [
            diagnostic("UNKNOWN_COMMAND", "error", `Unknown live command: ${request.command}`)
          ]));
      }
    }
  };
}
