import { handleWorkerRequest } from "./handler";
import type { WorkerRequest, WorkerResponse } from "../shared/workerProtocol";

const ctx = self as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as Partial<WorkerRequest> | null;
  if (!data || typeof data.id !== "string" || typeof data.type !== "string") {
    const response: WorkerResponse = {
      id: "invalid",
      type: "worker.error",
      payload: {},
      error: {
        code: "invalid_request",
        message: "Worker request must include id and type."
      }
    };
    ctx.postMessage(response);
    return;
  }

  const response = handleWorkerRequest(data as WorkerRequest);
  ctx.postMessage(response);
});
