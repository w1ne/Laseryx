import { runAgentCommand } from "../agentApi";
import { errorResponse } from "../responses";
import type { AgentJobInput, GenerateData, InspectData, PreflightData } from "../types";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolResponse } from "./types";
import { validateProtocolRequest } from "./validate";

export function handleProtocolRequest(input: unknown, job: AgentJobInput): AutomationProtocolResponse {
  const validation = validateProtocolRequest(input);

  if (!validation.ok) {
    return {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "unknown",
      ...errorResponse<InspectData | PreflightData | GenerateData>("inspect", validation.errors)
    };
  }

  const response = runAgentCommand(validation.request.command, job, validation.request.args);
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: validation.request.requestId,
    ...response
  };
}
