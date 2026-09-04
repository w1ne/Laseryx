import type { GenerateCommandOptions } from "../commands/generate";
import type { AgentCommand, AgentDiagnostic, AgentJobInput, AgentResponse, GenerateData, InspectData, JobSummary, PreflightData } from "../types";
import type { ProjectSummary } from "../../io/projectRepo";
import type { AutomationCapabilitiesData } from "../capabilities";

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
  | "automation.capabilities"
  | "project.new"
  | "project.save"
  | "project.list"
  | "project.open"
  | "project.delete"
  | "project.summary"
  | "project.exportJson"
  | "project.importJson"
  | "layer.list"
  | "layer.create"
  | "layer.rename"
  | "layer.delete"
  | "layer.setVisibility"
  | "layer.setLock"
  | "layer.get"
  | "material.list"
  | "material.applyToLayer";

export type AutomationProtocolCommand = AgentCommand | LiveAutomationCommand;

export type AutomationProtocolArgs = GenerateCommandOptions | Record<string, unknown>;

export type ProjectAutomationData =
  | AutomationCapabilitiesData
  | { project: ProjectSummary & { summary?: { objectCount: number; operationCount: number } } }
  | { projects: ProjectSummary[] }
  | { jobSummary: JobSummary }
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
