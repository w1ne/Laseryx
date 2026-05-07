import type {
  CamSettings,
  Document,
  GcodeDialect,
  JobStats,
  MachineProfile,
  PreviewGeom
} from "../core/model";

export type AgentCommand = "inspect" | "preflight" | "generate";

export type AgentDiagnosticSeverity = "error" | "warning";

export type AgentDiagnostic = {
  code: string;
  severity: AgentDiagnosticSeverity;
  message: string;
  path?: string;
};

export type AgentJobInput = {
  document: Document;
  camSettings: CamSettings;
  machineProfile: MachineProfile;
  dialect?: GcodeDialect;
};

export type AgentResponse<T> = {
  ok: boolean;
  command: AgentCommand;
  data: T | null;
  warnings: AgentDiagnostic[];
  errors: AgentDiagnostic[];
};

export type DocumentSummary = {
  version: number;
  units: string;
  layerCount: number;
  objectCount: number;
  objectsByKind: { shape: number; path: number; image: number };
  visibleLayerCount: number;
};

export type CamSummary = {
  operationCount: number;
  operations: Array<{
    id: string;
    name: string;
    mode: string;
    speed: number;
    power: number;
    passes: number;
  }>;
  optimizePaths: boolean;
};

export type MachineSummary = {
  id: string;
  name: string;
  bedMm: { w: number; h: number };
  origin: string;
  laserMode: string;
  baudRate: number;
};

export type JobSummary = {
  document: DocumentSummary;
  cam: CamSummary;
  machine: MachineSummary;
};

export type InspectData = {
  summary: JobSummary;
};

export type PreflightData = {
  ready: boolean;
  summary: JobSummary;
};

export type GenerateData = {
  summary: JobSummary;
  gcode?: string;
  gcodePath?: string;
  preview: PreviewGeom;
  stats: JobStats;
};
