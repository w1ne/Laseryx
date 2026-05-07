import { runAgentCommand } from "../agentApi";
import type { GenerateCommandOptions } from "../commands/generate";
import type { AgentJobInput, AgentResponse, GenerateData, InspectData, PreflightData } from "../types";

type BrowserResponse = AgentResponse<InspectData | PreflightData | GenerateData>;

export type BrowserAutomationApi = {
  inspect: () => BrowserResponse;
  preflight: () => BrowserResponse;
  generate: (options?: GenerateCommandOptions) => BrowserResponse;
  run: (command: string, input?: unknown, options?: GenerateCommandOptions) => BrowserResponse;
};

export type BrowserAutomationTarget = {
  laseryx?: BrowserAutomationApi;
};

export function createBrowserAutomation(getJob: () => AgentJobInput): BrowserAutomationApi {
  return {
    inspect: () => runAgentCommand("inspect", getJob()),
    preflight: () => runAgentCommand("preflight", getJob()),
    generate: (options = {}) => runAgentCommand("generate", getJob(), options),
    run: (command, input, options = {}) => runAgentCommand(command, input ?? getJob(), options)
  };
}

export function installBrowserAutomation(
  getJob: () => AgentJobInput,
  target: BrowserAutomationTarget = window
): () => void {
  const api = createBrowserAutomation(getJob);
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
