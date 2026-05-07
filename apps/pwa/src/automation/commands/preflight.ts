import { diagnostic, errorResponse, okResponse } from "../responses";
import { summarizeJob } from "../summarizeJob";
import type { AgentDiagnostic, AgentResponse, PreflightData } from "../types";
import { validateJob } from "../validateJob";

export function preflightCommand(input: unknown): AgentResponse<PreflightData> {
  const validation = validateJob(input);
  if (!validation.ok) {
    return errorResponse("preflight", validation.diagnostics);
  }

  const diagnostics: AgentDiagnostic[] = [...validation.diagnostics];
  const layerIds = new Set(validation.job.document.layers.map((layer) => layer.id));

  if (validation.job.document.objects.length === 0) {
    diagnostics.push(diagnostic("EMPTY_DOCUMENT", "warning", "Document has no objects"));
  }

  for (const obj of validation.job.document.objects) {
    if (!layerIds.has(obj.layerId)) {
      diagnostics.push(diagnostic("MISSING_LAYER", "error", `Object ${obj.id} references missing layer ${obj.layerId}`));
    }
  }

  const ready = diagnostics.every((item) => item.severity !== "error") && validation.job.document.objects.length > 0;

  return okResponse("preflight", {
    ready,
    summary: summarizeJob(validation.job)
  }, diagnostics);
}
