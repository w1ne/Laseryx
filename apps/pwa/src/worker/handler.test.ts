import { describe, expect, it } from "vitest";
import { handleWorkerRequest } from "./handler";
import type {
  CamSettings,
  Document,
  GcodeDialect,
  MachineProfile
} from "../core/model";
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

  it("handles core.generateGcode", () => {
    const document: Document = {
      version: 1,
      units: "mm",
      layers: [
        {
          id: "layer-1",
          name: "Cut",
          visible: true,
          locked: false,
          operationId: "op-1"
        }
      ],
      objects: [
        {
          kind: "shape",
          id: "rect-1",
          layerId: "layer-1",
          transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 5 },
          shape: { type: "rect", width: 20, height: 10 }
        }
      ]
    };

    const cam: CamSettings = {
      operations: [
        {
          id: "op-1",
          type: "vectorCut",
          speedMmMin: 1200,
          powerPct: 50,
          passes: 1,
          order: "shortestTravel"
        }
      ]
    };

    const machine: MachineProfile = {
      bedMm: { w: 300, h: 200 },
      origin: "frontLeft",
      sRange: { min: 0, max: 1000 },
      laserMode: "M4",
      preamble: ["G21", "G90"]
    };

    const dialect: GcodeDialect = {
      newline: "\n",
      useG0ForTravel: true,
      powerCommand: "S",
      enableLaser: "M4",
      disableLaser: "M5"
    };

    const request: WorkerRequest = {
      id: "3",
      type: "core.generateGcode",
      payload: { document, cam, machine, dialect }
    };
    const response = handleWorkerRequest(request);

    expect(response.type).toBe("core.generateGcode");
    expect(response.error).toBeUndefined();
    const payload = response.payload as { gcode: string };
    expect(payload.gcode).toContain("G1");
  });
});
