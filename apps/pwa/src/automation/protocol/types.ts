import type { GenerateCommandOptions } from "../commands/generate";
import type { AgentCommand, AgentDiagnostic, AgentJobInput, AgentResponse, GenerateData, InspectData, PreflightData } from "../types";
import type { ProjectSummary } from "../../io/projectRepo";

export const AUTOMATION_PROTOCOL_VERSION = 1;

export type AutomationProtocolVersion = typeof AUTOMATION_PROTOCOL_VERSION;

export type LiveAutomationCommand =
  | "cam.setOperation"
  | "ui.setActiveTab"
  | "ui.setPreviewMode"
  | "ui.selectDesignPanel"
  | "document.listObjects"
  | "document.selectObject"
  | "document.addRect"
  | "document.updateObjectTransform"
  | "document.setObjectLayer"
  | "document.deleteObject"
  | "project.new"
  | "project.save"
  | "project.list"
  | "project.open"
  | "project.delete"
  | "project.exportJson"
  | "project.importJson";

export type AutomationProtocolCommand = AgentCommand | LiveAutomationCommand;

export type AutomationProtocolArgs = GenerateCommandOptions | Record<string, unknown>;

export type ProjectAutomationData =
  | { project: ProjectSummary & { summary?: { objectCount: number; operationCount: number } } }
  | { projects: ProjectSummary[] }
  | { job: AgentJobInput }
  | { deletedProjectId: string };

export type AutomationProtocolRequest = {
  protocolVersion: AutomationProtocolVersion;
  requestId: string;
  command: AutomationProtocolCommand;
  args?: AutomationProtocolArgs;
};

export type AutomationProtocolResponse = AgentResponse<InspectData | PreflightData | GenerateData | ProjectAutomationData> & {
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
