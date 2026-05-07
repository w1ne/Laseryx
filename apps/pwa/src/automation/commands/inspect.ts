import { errorResponse, okResponse } from "../responses";
import { summarizeJob } from "../summarizeJob";
import type { AgentResponse, InspectData } from "../types";
import { validateJob } from "../validateJob";

export function inspectCommand(input: unknown): AgentResponse<InspectData> {
  const validation = validateJob(input);
  if (!validation.ok) {
    return errorResponse("inspect", validation.diagnostics);
  }

  return okResponse("inspect", {
    summary: summarizeJob(validation.job)
  }, validation.diagnostics);
}
