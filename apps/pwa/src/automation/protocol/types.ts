import type { GenerateCommandOptions } from "../commands/generate";
import type { AgentCommand, AgentDiagnostic, AgentResponse, GenerateData, InspectData, PreflightData } from "../types";

export const AUTOMATION_PROTOCOL_VERSION = 1;

export type AutomationProtocolVersion = typeof AUTOMATION_PROTOCOL_VERSION;

export type AutomationProtocolCommand = AgentCommand;

export type AutomationProtocolArgs = GenerateCommandOptions;

export type AutomationProtocolRequest = {
  protocolVersion: AutomationProtocolVersion;
  requestId: string;
  command: AutomationProtocolCommand;
  args?: AutomationProtocolArgs;
};

export type AutomationProtocolResponse = AgentResponse<InspectData | PreflightData | GenerateData> & {
  protocolVersion: AutomationProtocolVersion;
  requestId: string;
};

export type AutomationProtocolValidationResult =
  | {
      ok: true;
      request: AutomationProtocolRequest;
      errors: [];
    }
  | {
      ok: false;
      request: null;
      errors: AgentDiagnostic[];
    };
