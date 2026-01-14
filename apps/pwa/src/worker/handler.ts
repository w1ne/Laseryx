import { planCam } from "../core/cam";
import { emitGcode, generateGcode } from "../core/gcode";
import { ping } from "../core/ping";
import {
  isCamPlanRequest,
  isEmitGcodeRequest,
  isGenerateGcodeRequest,
  isPingRequest,
  type WorkerRequest,
  type WorkerResponse
} from "../shared/workerProtocol";

export function handleWorkerRequest(request: WorkerRequest): WorkerResponse {
  try {
    if (isPingRequest(request)) {
      return {
        id: request.id,
        type: request.type,
        payload: { value: ping() }
      };
    }

    if (isCamPlanRequest(request)) {
      const result = planCam(request.payload.document, request.payload.cam, request.payload.images);
      return {
        id: request.id,
        type: request.type,
        payload: result
      };
    }

    if (isEmitGcodeRequest(request)) {
      const { gcode, stats } = emitGcode(
        request.payload.plan,
        request.payload.cam,
        request.payload.machine,
        request.payload.dialect
      );
      return {
        id: request.id,
        type: request.type,
        payload: { gcode, stats }
      };
    }

    if (isGenerateGcodeRequest(request)) {
      const result = generateGcode(
        request.payload.document,
        request.payload.cam,
        request.payload.machine,
        request.payload.dialect,
        request.payload.images
      );
      return {
        id: request.id,
        type: request.type,
        payload: result
      };
    }

    return {
      id: request.id,
      type: request.type,
      payload: {},
      error: {
        code: "unknown_type",
        message: `Unknown worker request: ${request.type}`
      }
    };
  } catch (error) {
    return {
      id: request.id,
      type: request.type,
      payload: {},
      error: {
        code: "worker_error",
        message: error instanceof Error ? error.message : "Worker error"
      }
    }
  };
}
