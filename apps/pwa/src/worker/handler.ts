import { ping } from "../core/ping";
import { isPingRequest, type WorkerRequest, type WorkerResponse } from "../shared/workerProtocol";

export function handleWorkerRequest(request: WorkerRequest): WorkerResponse {
  if (isPingRequest(request)) {
    return {
      id: request.id,
      type: request.type,
      payload: { value: ping() }
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
}
