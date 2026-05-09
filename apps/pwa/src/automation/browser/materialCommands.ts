import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import type { Layer, MaterialPreset, Operation } from "../../core/model";
import { diagnostic, errorResponse, okResponse } from "../responses";
import type { AgentDiagnostic } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse
} from "../protocol/types";

export type MaterialAutomationCommand = "material.list" | "material.applyToLayer";

export type MaterialCommandExecutorOptions = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
};

type MaterialSummary = {
  id: string;
  name: string;
  mode: "line" | "fill";
  speed: number;
  power: number;
  passes: number;
  lineInterval?: number;
  angle?: number;
};

type MaterialCommandResponseData =
  | { materials: MaterialSummary[] }
  | { layerId: string; operationId: string; applied: Partial<Operation> };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function wrap(
  request: AutomationProtocolRequest,
  response: ReturnType<typeof okResponse<MaterialCommandResponseData>>
): AutomationProtocolResponse {
  return { protocolVersion: AUTOMATION_PROTOCOL_VERSION, requestId: request.requestId, ...response } as AutomationProtocolResponse;
}

function summarizeMaterial(p: MaterialPreset): MaterialSummary {
  return {
    id: p.id,
    name: p.name,
    mode: p.mode,
    speed: p.speed,
    power: p.power,
    passes: p.passes,
    ...(p.lineInterval !== undefined ? { lineInterval: p.lineInterval } : {}),
    ...(p.angle !== undefined ? { angle: p.angle } : {})
  };
}

type ResolveOk<T> = { ok: true; value: T };
type ResolveErr = { ok: false; diagnostic: AgentDiagnostic };

function resolveMaterial(state: AppState, address: unknown): ResolveOk<MaterialPreset> | ResolveErr {
  if (typeof address !== "string" || address.trim() === "") {
    return { ok: false, diagnostic: diagnostic("INVALID_INPUT", "error", "Missing material") };
  }
  const presets = state.materialPresets;
  const byId = presets.find((p) => p.id === address);
  if (byId) return { ok: true, value: byId };
  const byName = presets.filter((p) => p.name === address);
  if (byName.length === 1) return { ok: true, value: byName[0] };
  if (byName.length > 1) {
    return { ok: false, diagnostic: diagnostic("MATERIAL_AMBIGUOUS", "error", `Multiple materials named "${address}"`) };
  }
  return { ok: false, diagnostic: diagnostic("MATERIAL_NOT_FOUND", "error", `Material not found: ${address}`) };
}

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
    return { ok: false, diagnostic: diagnostic("LAYER_AMBIGUOUS", "error", `Multiple layers named "${address}"`) };
  }
  return { ok: false, diagnostic: diagnostic("LAYER_NOT_FOUND", "error", `Layer not found: ${address}`) };
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function executeMaterialCommand(
  command: MaterialAutomationCommand,
  options: MaterialCommandExecutorOptions,
  request: AutomationProtocolRequest
): AutomationProtocolResponse {
  const state = options.getState();
  const args = asRecord(request.args);

  switch (command) {
    case "material.list":
      return wrap(request, okResponse<MaterialCommandResponseData>("material.list" as never, {
        materials: state.materialPresets.map(summarizeMaterial)
      }));
    case "material.applyToLayer": {
      const m = resolveMaterial(state, args.material);
      if (!m.ok) {
        return wrap(request, errorResponse<MaterialCommandResponseData>("material.applyToLayer", [m.diagnostic]));
      }
      const l = resolveLayer(state, args.layer);
      if (!l.ok) {
        return wrap(request, errorResponse<MaterialCommandResponseData>("material.applyToLayer", [l.diagnostic]));
      }
      const preset = m.value;
      const layer = l.value;

      const appliedFields: Partial<Operation> = {
        mode: preset.mode,
        speed: preset.speed,
        power: preset.power,
        passes: preset.passes,
        ...(preset.lineInterval !== undefined ? { lineInterval: preset.lineInterval } : {}),
        ...(preset.angle !== undefined ? { angle: preset.angle } : {})
      };

      if (!layer.operationId) {
        const operationId = `op-${uniqueSuffix()}`;
        const newOp: Operation = {
          id: operationId,
          name: preset.name,
          mode: preset.mode,
          speed: preset.speed,
          power: preset.power,
          passes: preset.passes,
          ...(preset.lineInterval !== undefined ? { lineInterval: preset.lineInterval } : {}),
          ...(preset.angle !== undefined ? { angle: preset.angle } : {})
        };
        options.dispatch({ type: "ADD_OPERATION", payload: newOp });
        options.dispatch({
          type: "SET_DOCUMENT",
          payload: {
            ...state.document,
            layers: state.document.layers.map((x) => x.id === layer.id ? { ...x, operationId } : x)
          }
        });
        return wrap(request, okResponse<MaterialCommandResponseData>("material.applyToLayer", {
          layerId: layer.id, operationId, applied: appliedFields
        } as never));
      }

      const operations = state.camSettings.operations;
      const target = operations.find((o) => o.id === layer.operationId);
      if (!target) {
        // Defensive: operationId points to nonexistent op. Treat as missing.
        const operationId = `op-${uniqueSuffix()}`;
        const newOp: Operation = {
          id: operationId, name: preset.name, mode: preset.mode, speed: preset.speed,
          power: preset.power, passes: preset.passes,
          ...(preset.lineInterval !== undefined ? { lineInterval: preset.lineInterval } : {}),
          ...(preset.angle !== undefined ? { angle: preset.angle } : {})
        };
        options.dispatch({ type: "ADD_OPERATION", payload: newOp });
        options.dispatch({
          type: "SET_DOCUMENT",
          payload: {
            ...state.document,
            layers: state.document.layers.map((x) => x.id === layer.id ? { ...x, operationId } : x)
          }
        });
        return wrap(request, okResponse<MaterialCommandResponseData>("material.applyToLayer", {
          layerId: layer.id, operationId, applied: appliedFields
        } as never));
      }

      const updated: Operation = { ...target, ...appliedFields };
      options.dispatch({
        type: "SET_CAM_SETTINGS",
        payload: {
          ...state.camSettings,
          operations: operations.map((o) => o.id === target.id ? updated : o)
        }
      });
      return wrap(request, okResponse<MaterialCommandResponseData>("material.applyToLayer", {
        layerId: layer.id, operationId: target.id, applied: appliedFields
      } as never));
    }
    default:
      return wrap(request, errorResponse<MaterialCommandResponseData>(command as never, [
        diagnostic("UNKNOWN_COMMAND", "error", `Unsupported material command: ${command}`)
      ]));
  }
}
