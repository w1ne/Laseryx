import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import type { MacroObj, Obj, ShapeObj, Transform } from "../../core/model";
import {
  defaultParamsForDef,
  getMacroDef,
  listMacroDefs,
  nextCascadeTransform,
  revalidateMacroParams
} from "../../core/macros";
import { diagnostic, errorResponse, okResponse } from "../responses";
import type { AgentDiagnostic } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse
} from "../protocol/types";

export type DocumentAutomationCommand =
  | "document.addRect"
  | "document.addMacro"
  | "document.updateMacroParams"
  | "macros.listDefs"
  | "document.updateObjectTransform"
  | "document.setObjectLayer"
  | "document.deleteObject";

export type DocumentCommandExecutorOptions = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
};

type DocumentCommandResponseData =
  | { object: Obj }
  | { selectedObjectId: string | null }
  | { object: Obj; dryRun: true; changed: false }
  | { selectedObjectId: string | null; dryRun: true; changed: false }
  | { defs: ReturnType<typeof listMacroDefs> };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isDryRun(args: Record<string, unknown>): boolean {
  return args.dryRun === true;
}

function cloneObject<T extends Obj>(object: T): T {
  return structuredClone(object);
}

function wrap(
  request: AutomationProtocolRequest,
  response: ReturnType<typeof okResponse<DocumentCommandResponseData>>
): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: request.requestId,
    ...response
  } as AutomationProtocolResponse;
}

function documentMutationError(message: string): AgentDiagnostic {
  return diagnostic("INVALID_DOCUMENT_MUTATION", "error", message);
}

function stringArg(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[]): string | undefined {
  const value = args[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  diagnostics.push(documentMutationError(`Missing ${key}`));
  return undefined;
}

function optionalFiniteNumber(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[]): number | undefined {
  if (args[key] === undefined) return undefined;
  const value = Number(args[key]);
  if (!Number.isFinite(value)) {
    diagnostics.push(documentMutationError(`${key} must be a number`));
    return undefined;
  }
  return value;
}

function positiveNumberArg(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[]): number | undefined {
  const value = optionalFiniteNumber(args, key, diagnostics);
  if (value !== undefined && value <= 0) {
    diagnostics.push(documentMutationError(`${key} must be greater than 0`));
  }
  return value;
}

function requiredPositiveNumberArg(args: Record<string, unknown>, key: string, diagnostics: AgentDiagnostic[]): number | undefined {
  if (args[key] === undefined) {
    diagnostics.push(documentMutationError(`Missing ${key}`));
    return undefined;
  }
  return positiveNumberArg(args, key, diagnostics);
}

function findObject(
  state: AppState,
  objectId: string,
  command: DocumentAutomationCommand,
  request: AutomationProtocolRequest
): AutomationProtocolResponse | Obj {
  const object = state.document.objects.find((item) => item.id === objectId);
  if (!object) {
    return wrap(request, errorResponse<DocumentCommandResponseData>(command, [
      diagnostic("NOT_FOUND", "error", `Object not found: ${objectId}`)
    ]));
  }
  return object;
}

function requireLayer(
  state: AppState,
  layerId: string,
  command: DocumentAutomationCommand,
  request: AutomationProtocolRequest
): AutomationProtocolResponse | undefined {
  if (!state.document.layers.some((item) => item.id === layerId)) {
    return wrap(request, errorResponse<DocumentCommandResponseData>(command, [
      diagnostic("NOT_FOUND", "error", `Layer not found: ${layerId}`)
    ]));
  }
  return undefined;
}

function transformPatch(args: Record<string, unknown>, diagnostics: AgentDiagnostic[]): Partial<Transform> {
  const fields: Array<[keyof Transform, string]> = [
    ["a", "a"],
    ["b", "b"],
    ["c", "c"],
    ["d", "d"],
    ["e", "e"],
    ["f", "f"],
    ["e", "x"],
    ["f", "y"],
    ["a", "scaleX"],
    ["d", "scaleY"],
    ["c", "shearX"],
    ["b", "shearY"]
  ];
  const changes: Partial<Transform> = {};
  for (const [field, key] of fields) {
    const value = optionalFiniteNumber(args, key, diagnostics);
    if (value !== undefined) {
      changes[field] = value;
    }
  }
  return changes;
}

function addRect(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const objectId = stringArg(args, "object", diagnostics);
  const layerId = stringArg(args, "layer", diagnostics);
  const width = requiredPositiveNumberArg(args, "width", diagnostics);
  const height = requiredPositiveNumberArg(args, "height", diagnostics);
  const x = optionalFiniteNumber(args, "x", diagnostics) ?? 0;
  const y = optionalFiniteNumber(args, "y", diagnostics) ?? 0;

  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.addRect", diagnostics));
  }

  const state = options.getState();
  if (state.document.objects.some((object) => object.id === objectId)) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.addRect", [
      diagnostic("ALREADY_EXISTS", "error", `Object already exists: ${objectId}`)
    ]));
  }
  const layerError = requireLayer(state, layerId!, "document.addRect", request);
  if (layerError) return layerError;

  const object: ShapeObj = {
    kind: "shape",
    id: objectId!,
    layerId: layerId!,
    transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
    shape: { type: "rect", width: width!, height: height! }
  };
  options.dispatch({ type: "ADD_OBJECT", payload: object });
  options.dispatch({ type: "SELECT_OBJECT", payload: object.id });

  return wrap(request, okResponse<DocumentCommandResponseData>("document.addRect", { object }));
}

function updateObjectTransform(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const objectId = stringArg(args, "object", diagnostics);
  const changes = transformPatch(args, diagnostics);

  if (Object.keys(changes).length === 0) {
    diagnostics.push(documentMutationError("At least one transform field is required"));
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.updateObjectTransform", diagnostics));
  }

  const state = options.getState();
  const object = findObject(state, objectId!, "document.updateObjectTransform", request);
  if ("protocolVersion" in object) return object;

  const updated: Obj = {
    ...object,
    transform: {
      ...object.transform,
      ...changes
    }
  };
  if (isDryRun(args)) {
    return wrap(request, okResponse<DocumentCommandResponseData>("document.updateObjectTransform", {
      dryRun: true,
      changed: false,
      object: cloneObject(updated)
    }));
  }
  options.dispatch({ type: "UPDATE_OBJECT", payload: { id: object.id, changes: { transform: updated.transform } } });
  return wrap(request, okResponse<DocumentCommandResponseData>("document.updateObjectTransform", { object: updated }));
}

function setObjectLayer(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const objectId = stringArg(args, "object", diagnostics);
  const layerId = stringArg(args, "layer", diagnostics);
  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.setObjectLayer", diagnostics));
  }

  const state = options.getState();
  const object = findObject(state, objectId!, "document.setObjectLayer", request);
  if ("protocolVersion" in object) return object;
  const layerError = requireLayer(state, layerId!, "document.setObjectLayer", request);
  if (layerError) return layerError;

  const updated: Obj = { ...object, layerId: layerId! };
  options.dispatch({ type: "UPDATE_OBJECT", payload: { id: object.id, changes: { layerId: layerId! } } });
  return wrap(request, okResponse<DocumentCommandResponseData>("document.setObjectLayer", { object: updated }));
}

function deleteObject(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const objectId = stringArg(args, "object", diagnostics);
  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.deleteObject", diagnostics));
  }

  const state = options.getState();
  const object = findObject(state, objectId!, "document.deleteObject", request);
  if ("protocolVersion" in object) return object;
  const selectedObjectId = state.selectedObjectId === object.id ? null : state.selectedObjectId;
  if (isDryRun(args)) {
    return wrap(request, okResponse<DocumentCommandResponseData>("document.deleteObject", {
      dryRun: true,
      changed: false,
      selectedObjectId
    }));
  }
  options.dispatch({ type: "DELETE_OBJECT", payload: object.id });
  return wrap(request, okResponse<DocumentCommandResponseData>("document.deleteObject", {
    selectedObjectId
  }));
}

function listDefs(request: AutomationProtocolRequest): AutomationProtocolResponse {
  return wrap(request, okResponse<DocumentCommandResponseData>("macros.listDefs", {
    defs: listMacroDefs()
  }));
}

function addMacro(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const defId = stringArg(args, "defId", diagnostics);
  const objectId = typeof args.object === "string" && args.object.trim() !== ""
    ? args.object
    : `macro-${Date.now()}`;
  const layerIdArg = typeof args.layer === "string" && args.layer.trim() !== "" ? args.layer : undefined;
  const x = optionalFiniteNumber(args, "x", diagnostics);
  const y = optionalFiniteNumber(args, "y", diagnostics);
  const paramsArg = typeof args.params === "object" && args.params !== null && !Array.isArray(args.params)
    ? args.params as Record<string, unknown>
    : {};

  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.addMacro", diagnostics));
  }

  const def = getMacroDef(defId!);
  if (!def) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.addMacro", [
      diagnostic("NOT_FOUND", "error", `Unknown macro defId: ${defId}`)
    ]));
  }

  const state = options.getState();
  if (state.document.objects.some((object) => object.id === objectId)) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.addMacro", [
      diagnostic("ALREADY_EXISTS", "error", `Object already exists: ${objectId}`)
    ]));
  }

  let layerId = layerIdArg;
  if (layerId) {
    const layerError = requireLayer(state, layerId, "document.addMacro", request);
    if (layerError) return layerError;
  } else {
    layerId = state.document.layers[0]?.id;
    if (!layerId) {
      return wrap(request, errorResponse<DocumentCommandResponseData>("document.addMacro", [
        diagnostic("INVALID_DOCUMENT_MUTATION", "error", "No layer available")
      ]));
    }
  }

  const params = revalidateMacroParams(def.id, defaultParamsForDef(def), paramsArg) ?? defaultParamsForDef(def);
  const cascade = nextCascadeTransform(state.document, state.machineProfile?.bedMm);
  const transform = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: x ?? cascade.e,
    f: y ?? cascade.f
  };

  const object: MacroObj = {
    kind: "macro",
    id: objectId,
    layerId,
    transform,
    defId: def.id,
    defVersion: def.defVersion,
    params
  };

  options.dispatch({ type: "ADD_OBJECT", payload: object });
  options.dispatch({ type: "SELECT_OBJECT", payload: object.id });
  return wrap(request, okResponse<DocumentCommandResponseData>("document.addMacro", { object }));
}

function updateMacroParams(options: DocumentCommandExecutorOptions, request: AutomationProtocolRequest): AutomationProtocolResponse {
  const args = asRecord(request.args);
  const diagnostics: AgentDiagnostic[] = [];
  const objectId = stringArg(args, "object", diagnostics);
  const paramsArg = typeof args.params === "object" && args.params !== null && !Array.isArray(args.params)
    ? args.params as Record<string, unknown>
    : undefined;
  if (paramsArg === undefined) {
    diagnostics.push(documentMutationError("Missing params"));
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.updateMacroParams", diagnostics));
  }

  const state = options.getState();
  const object = findObject(state, objectId!, "document.updateMacroParams", request);
  if ("protocolVersion" in object) return object;
  if (object.kind !== "macro") {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.updateMacroParams", [
      diagnostic("INVALID_DOCUMENT_MUTATION", "error", `Object is not a macro: ${objectId}`)
    ]));
  }

  const nextParams = revalidateMacroParams(object.defId, object.params, paramsArg!);
  if (!nextParams) {
    return wrap(request, errorResponse<DocumentCommandResponseData>("document.updateMacroParams", [
      diagnostic("NOT_FOUND", "error", `Unknown macro defId: ${object.defId}`)
    ]));
  }

  const updated: MacroObj = { ...object, params: nextParams };
  if (isDryRun(args)) {
    return wrap(request, okResponse<DocumentCommandResponseData>("document.updateMacroParams", {
      dryRun: true,
      changed: false,
      object: cloneObject(updated)
    }));
  }
  options.dispatch({ type: "UPDATE_OBJECT", payload: { id: object.id, changes: { params: nextParams } } });
  return wrap(request, okResponse<DocumentCommandResponseData>("document.updateMacroParams", { object: updated }));
}

export function executeDocumentCommand(
  command: DocumentAutomationCommand,
  options: DocumentCommandExecutorOptions,
  request: AutomationProtocolRequest
): AutomationProtocolResponse {
  switch (command) {
    case "document.addRect":
      return addRect(options, request);
    case "document.addMacro":
      return addMacro(options, request);
    case "document.updateMacroParams":
      return updateMacroParams(options, request);
    case "macros.listDefs":
      return listDefs(request);
    case "document.updateObjectTransform":
      return updateObjectTransform(options, request);
    case "document.setObjectLayer":
      return setObjectLayer(options, request);
    case "document.deleteObject":
      return deleteObject(options, request);
  }
}
