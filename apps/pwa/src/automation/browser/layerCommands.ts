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
    default:
      return wrap(request, errorResponse<LayerCommandResponseData>(command as never, [
        diagnostic("UNKNOWN_COMMAND", "error", `Unsupported layer command: ${command}`)
      ]));
  }
}
