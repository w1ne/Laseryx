import type {
  CamPlan,
  CamSettings,
  Document,
  GcodeDialect,
  JobStats,
  MachineProfile,
  PreviewGeom
} from "../core/model";

export type WorkerError = {
  code: string;
  message: string;
};

export type WorkerRequest = {
  id: string;
  type: string;
  payload: unknown;
};

export type WorkerResponse = {
  id: string;
  type: string;
  payload: unknown;
  error?: WorkerError;
};

export type PingRequest = {
  id: string;
  type: "worker.ping";
  payload: Record<string, never>;
};

export type PingResponse = {
  id: string;
  type: "worker.ping";
  payload: { value: "pong" };
};

export function isPingRequest(request: WorkerRequest): request is PingRequest {
  return request.type === "worker.ping";
}

export type CamPlanRequest = {
  id: string;
  type: "core.camPlan";
  payload: { document: Document; cam: CamSettings; images?: Map<string, ImageData> };
};

export type CamPlanResponse = {
  id: string;
  type: "core.camPlan";
  payload: { plan: CamPlan; preview: PreviewGeom; warnings: string[] };
};

export function isCamPlanRequest(request: WorkerRequest): request is CamPlanRequest {
  return request.type === "core.camPlan";
}

export type EmitGcodeRequest = {
  id: string;
  type: "core.emitGcode";
  payload: { plan: CamPlan; cam: CamSettings; machine: MachineProfile; dialect: GcodeDialect };
};

export type EmitGcodeResponse = {
  id: string;
  type: "core.emitGcode";
  payload: { gcode: string; stats: JobStats };
};

export function isEmitGcodeRequest(request: WorkerRequest): request is EmitGcodeRequest {
  return request.type === "core.emitGcode";
}

export type GenerateGcodeRequest = {
  id: string;
  type: "core.generateGcode";
  payload: {
    document: Document;
    cam: CamSettings;
    machine: MachineProfile;
    dialect: GcodeDialect;
    images?: Map<string, ImageData>;
  };
};

export type GenerateGcodeResponse = {
  id: string;
  type: "core.generateGcode";
  payload: { gcode: string; preview: PreviewGeom; stats: JobStats; warnings: string[] };
};

export function isGenerateGcodeRequest(request: WorkerRequest): request is GenerateGcodeRequest {
  return request.type === "core.generateGcode";
}
