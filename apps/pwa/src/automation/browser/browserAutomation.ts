import { runAgentCommand } from "../agentApi";
import type { GenerateCommandOptions } from "../commands/generate";
import { createInAppAutomationBridge, type InAppAutomationBridge } from "./inAppBridge";
import type { AgentJobInput, AgentResponse, GenerateData, InspectData, PreflightData } from "../types";

type BrowserResponse = AgentResponse<InspectData | PreflightData | GenerateData>;

export type BrowserAutomationApi = {
  protocol: InAppAutomationBridge;
  inspect: () => BrowserResponse;
  preflight: () => BrowserResponse;
  generate: (options?: GenerateCommandOptions) => BrowserResponse;
  run: (command: string, input?: unknown, options?: GenerateCommandOptions) => BrowserResponse;
};

export type BrowserAutomationTarget = {
  laseryx?: BrowserAutomationApi;
};

export function createBrowserAutomation(getJob: () => AgentJobInput, liveBridge?: InAppAutomationBridge): BrowserAutomationApi {
  return {
    protocol: createInAppAutomationBridge(getJob, liveBridge),
    inspect: () => runAgentCommand("inspect", getJob()),
    preflight: () => runAgentCommand("preflight", getJob()),
    generate: (options = {}) => runAgentCommand("generate", getJob(), options),
    run: (command, input, options = {}) => runAgentCommand(command, input ?? getJob(), options)
  };
}

export function installBrowserAutomation(
  getJob: () => AgentJobInput,
  target: BrowserAutomationTarget = window,
  liveBridge?: InAppAutomationBridge
): () => void {
  const api = createBrowserAutomation(getJob, liveBridge);
  target.laseryx = api;
  return () => {
    if (target.laseryx === api) {
      delete target.laseryx;
    }
  };
}

declare global {
  interface Window {
    laseryx?: BrowserAutomationApi;
  }
}
