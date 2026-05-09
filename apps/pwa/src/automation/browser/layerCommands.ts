import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import type { Layer } from "../../core/model";
import { diagnostic, errorResponse, okResponse } from "../responses";
import type { AgentDiagnostic } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse
} from "../protocol/types";

export type LayerAutomationCommand =
  | "layer.list"
  | "layer.create"
  | "layer.rename"
  | "layer.delete"
  | "layer.setVisibility"
  | "layer.setLock"
  | "layer.get";

export type LayerCommandExecutorOptions = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
};

type LayerSummary = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  operationId?: string;
  objectCount: number;
};

type LayerCommandResponseData =
  | { layers: LayerSummary[] }
  | { id: string; operationId: string }
  | { id: string; name: string }
  | { id: string; visible: boolean }
  | { id: string; locked: boolean }
  | { layer: LayerSummary & {
      operation?: { mode: string; speed: number; power: number; passes: number; lineInterval?: number; angle?: number };
    } };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function wrap(
  request: AutomationProtocolRequest,
  response: ReturnType<typeof okResponse<LayerCommandResponseData>>
): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: request.requestId,
    ...response
  } as AutomationProtocolResponse;
}

type ResolveOk<T> = { ok: true; value: T };
type ResolveErr = { ok: false; diagnostic: AgentDiagnostic };

function resolveLayer(state: AppState, address: unknown): ResolveOk<Layer> | ResolveErr {
  if (typeof address !== "string" || address.trim() === "") {
    return { ok: false, diagnostic: diagnostic("INVALID_INPUT", "error", "Missing layer") };
  }
  const layers = state.document.layers;
  const byId = layers.find((l) => l.id === address);
  if (byId) return { ok: true, value: byId };
  const byName = layers.filter((l) => l.name === address);
  if (byName.length === 1) return { ok: true, value: byName[0] };
  if (byName.length > 1) {
    const ids = byName.map((l) => l.id).join(", ");
    return {
      ok: false,
      diagnostic: diagnostic(
        "LAYER_AMBIGUOUS",
        "error",
        `Multiple layers named "${address}" (ids: ${ids})`
      )
    };
  }
  return { ok: false, diagnostic: diagnostic("LAYER_NOT_FOUND", "error", `Layer not found: ${address}`) };
}

function summarize(state: AppState, layer: Layer): LayerSummary {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    operationId: layer.operationId,
    objectCount: state.document.objects.filter((o) => o.layerId === layer.id).length
  };
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function executeLayerCommand(
  command: LayerAutomationCommand,
  options: LayerCommandExecutorOptions,
  request: AutomationProtocolRequest
): AutomationProtocolResponse {
  const state = options.getState();
  const args = asRecord(request.args);

  switch (command) {
    case "layer.list":
      return wrap(request, okResponse<LayerCommandResponseData>("layer.list" as never, {
        layers: state.document.layers.map((l) => summarize(state, l))
      }));
    case "layer.create": {
      const suffix = uniqueSuffix();
      const layerId = `layer-${suffix}`;
      const operationId = `op-${suffix}`;
      const requestedName = typeof args.name === "string" && args.name.trim() !== "" ? args.name : `Layer ${state.document.layers.length + 1}`;
      options.dispatch({
        type: "ADD_LAYER",
        payload: { id: layerId, name: requestedName, visible: true, locked: false, operationId }
      });
      options.dispatch({
        type: "ADD_OPERATION",
        payload: { id: operationId, name: "Cut", mode: "line", speed: 1000, power: 50, passes: 1, order: "insideOut" }
      });
      return wrap(request, okResponse<LayerCommandResponseData>("layer.create" as never, { id: layerId, operationId }));
    }
    case "layer.rename": {
      const resolved = resolveLayer(state, args.layer);
      if (!resolved.ok) {
        return wrap(request, errorResponse<LayerCommandResponseData>("layer.rename", [resolved.diagnostic]));
      }
      const newName = typeof args.name === "string" && args.name.trim() !== "" ? args.name : null;
      if (newName === null) {
        return wrap(request, errorResponse<LayerCommandResponseData>("layer.rename", [
          diagnostic("INVALID_INPUT", "error", "Missing name")
        ]));
      }
      options.dispatch({
        type: "SET_DOCUMENT",
        payload: {
          ...state.document,
          layers: state.document.layers.map((l) => l.id === resolved.value.id ? { ...l, name: newName } : l)
        }
      });
      return wrap(request, okResponse<LayerCommandResponseData>("layer.rename", { id: resolved.value.id, name: newName }));
    }
    case "layer.delete": {
      const resolved = resolveLayer(state, args.layer);
      if (!resolved.ok) {
        return wrap(request, errorResponse<LayerCommandResponseData>("layer.delete", [resolved.diagnostic]));
      }
      if (state.document.layers.length <= 1) {
        return wrap(request, errorResponse<LayerCommandResponseData>("layer.delete", [
          diagnostic("LAYER_LAST", "error", "Cannot delete the last layer")
        ]));
      }
      const objectIds = state.document.objects.filter((o) => o.layerId === resolved.value.id).map((o) => o.id);
      if (objectIds.length > 0) {
        return wrap(request, errorResponse<LayerCommandResponseData>("layer.delete", [
          diagnostic("LAYER_HAS_OBJECTS", "error", `Layer "${resolved.value.name}" still contains objects`)
        ]));
      }
      options.dispatch({ type: "DELETE_LAYER", payload: resolved.value.id });
      return wrap(request, okResponse<LayerCommandResponseData>("layer.delete", { id: resolved.value.id, name: resolved.value.name } as never));
    }
    case "layer.setVisibility":
    case "layer.setLock": {
      const resolved = resolveLayer(state, args.layer);
      if (!resolved.ok) {
        return wrap(request, errorResponse<LayerCommandResponseData>(command, [resolved.diagnostic]));
      }
      const flagKey = command === "layer.setVisibility" ? "visible" : "locked";
      const value = args[flagKey];
      if (typeof value !== "boolean") {
        return wrap(request, errorResponse<LayerCommandResponseData>(command, [
          diagnostic("INVALID_INPUT", "error", `${flagKey} must be a boolean`)
        ]));
      }
      options.dispatch({
        type: "SET_DOCUMENT",
        payload: {
          ...state.document,
          layers: state.document.layers.map((l) => l.id === resolved.value.id ? { ...l, [flagKey]: value } : l)
        }
      });
      const data = command === "layer.setVisibility"
        ? { id: resolved.value.id, visible: value }
        : { id: resolved.value.id, locked: value };
      return wrap(request, okResponse<LayerCommandResponseData>(command as never, data as never));
    }
    default:
      return wrap(request, errorResponse<LayerCommandResponseData>(command as never, [
        diagnostic("UNKNOWN_COMMAND", "error", `Unsupported layer command: ${command}`)
      ]));
  }
}
