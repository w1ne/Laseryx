import { createRequestId } from "../shared/ids";
import type { WorkerRequest, WorkerResponse } from "../shared/workerProtocol";

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

export function createWorkerClient(worker: Worker) {
  const pending = new Map<string, PendingRequest>();

  const onMessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (!message || typeof message.id !== "string") {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error.message));
      return;
    }
    entry.resolve(message);
  };

  worker.addEventListener("message", onMessage);

  const request = (type: string, payload: unknown) =>
    new Promise<WorkerResponse>((resolve, reject) => {
      const id = createRequestId();
      pending.set(id, { resolve, reject });
      const message: WorkerRequest = { id, type, payload };
      worker.postMessage(message);
    });

  return {
    ping: async (): Promise<string> => {
      const response = await request("worker.ping", {});
      const payload = response.payload as { value?: string };
      if (!payload || payload.value !== "pong") {
        throw new Error("Unexpected ping response");
      }
      return payload.value;
    },
    dispose: () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
    }
  };
}
