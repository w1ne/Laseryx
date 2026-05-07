import type { AgentJobInput } from "../types";
import { handleProtocolRequest } from "../protocol/handler";
import type { AutomationProtocolRequest, AutomationProtocolResponse, LiveAutomationCommand } from "../protocol/types";
import { liveAutomationCapabilities } from "../capabilities";

export type InAppAutomationBridge = {
  request: (request: AutomationProtocolRequest) => AutomationProtocolResponse | Promise<AutomationProtocolResponse>;
};

const LIVE_COMMANDS = new Set<LiveAutomationCommand>(
  liveAutomationCapabilities().map((capability) => capability.command as LiveAutomationCommand)
);

export function createInAppAutomationBridge(
  getJob: () => AgentJobInput,
  liveBridge?: InAppAutomationBridge
): InAppAutomationBridge {
  return {
    request: (request) => {
      if (LIVE_COMMANDS.has(request.command as LiveAutomationCommand) && liveBridge) {
        return liveBridge.request(request);
      }
      return handleProtocolRequest(request, getJob());
    }
  };
}
