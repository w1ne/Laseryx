import type { AgentJobInput } from "../types";
import { handleProtocolRequest } from "../protocol/handler";
import type { AutomationProtocolRequest, AutomationProtocolResponse, LiveAutomationCommand } from "../protocol/types";

export type InAppAutomationBridge = {
  request: (request: AutomationProtocolRequest) => AutomationProtocolResponse;
};

const LIVE_COMMANDS = new Set<LiveAutomationCommand>([
  "cam.setOperation",
  "ui.setActiveTab",
  "ui.setPreviewMode",
  "ui.selectDesignPanel",
  "document.listObjects",
  "document.selectObject",
  "document.addRect",
  "document.updateObjectTransform",
  "document.setObjectLayer",
  "document.deleteObject"
]);

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
