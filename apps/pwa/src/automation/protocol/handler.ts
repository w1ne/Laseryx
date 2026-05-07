import { runAgentCommand } from "../agentApi";
import { errorResponse } from "../responses";
import { automationCapabilities, type AutomationCapabilitiesData } from "../capabilities";
import type { AgentJobInput, GenerateData, InspectData, PreflightData } from "../types";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolResponse } from "./types";
import { validateProtocolRequest } from "./validate";

function responseRequestId(input: unknown): string {
  return typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    "requestId" in input &&
    typeof input.requestId === "string" &&
    input.requestId.length > 0
    ? input.requestId
    : "unknown";
}

export function handleProtocolRequest(input: unknown, job: AgentJobInput): AutomationProtocolResponse {
  const validation = validateProtocolRequest(input);

  if (!validation.ok) {
    return {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: responseRequestId(input),
      ...errorResponse<InspectData | PreflightData | GenerateData>("inspect", validation.errors)
    };
  }

  if (validation.request.command === "automation.capabilities") {
    return {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: validation.request.requestId,
      ok: true,
      command: "automation.capabilities",
      data: { capabilities: automationCapabilities() } satisfies AutomationCapabilitiesData,
      warnings: [],
      errors: []
    } as AutomationProtocolResponse;
  }

  const response = runAgentCommand(validation.request.command, job, validation.request.args);
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: validation.request.requestId,
    ...response
  };
}
