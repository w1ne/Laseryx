import type { AgentJobInput } from "../types";
import { handleProtocolRequest } from "../protocol/handler";
import type { AutomationProtocolRequest, AutomationProtocolResponse } from "../protocol/types";

export type InAppAutomationBridge = {
  request: (request: AutomationProtocolRequest) => AutomationProtocolResponse;
};

export function createInAppAutomationBridge(getJob: () => AgentJobInput): InAppAutomationBridge {
  return {
    request: (request) => handleProtocolRequest(request, getJob())
  };
}
