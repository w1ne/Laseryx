import { describe, expect, it } from "vitest";
import { handleWorkerRequest } from "./handler";
import type { WorkerRequest } from "../shared/workerProtocol";

describe("handleWorkerRequest", () => {
  it("responds to worker.ping", () => {
    const request: WorkerRequest = { id: "1", type: "worker.ping", payload: {} };
    const response = handleWorkerRequest(request);

    expect(response.id).toBe("1");
    expect(response.type).toBe("worker.ping");
    expect(response.error).toBeUndefined();
    expect(response.payload).toEqual({ value: "pong" });
  });

  it("returns an error for unknown types", () => {
    const request: WorkerRequest = { id: "2", type: "worker.unknown", payload: {} };
    const response = handleWorkerRequest(request);

    expect(response.error?.code).toBe("unknown_type");
  });
});
