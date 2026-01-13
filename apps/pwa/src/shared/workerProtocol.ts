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
