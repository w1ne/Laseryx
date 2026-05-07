import { describe, expect, it } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
import type { AgentJobInput } from "../types";
import { handleProtocolRequest } from "./handler";
import { AUTOMATION_PROTOCOL_VERSION } from "./types";
import { validateProtocolRequest } from "./validate";

const job = minimalJob as AgentJobInput;

describe("automation protocol", () => {
  it("accepts a valid request envelope", () => {
    const result = validateProtocolRequest({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-1",
      command: "inspect",
      args: {}
    });

    expect(result.ok).toBe(true);
    expect(result.request?.command).toBe("inspect");
  });

  it("accepts project lifecycle request envelopes", () => {
    const result = validateProtocolRequest({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-project",
      command: "project.save",
      args: { name: "Agent Project" }
    });

    expect(result.ok).toBe(true);
    expect(result.request?.command).toBe("project.save");
    expect(result.request?.args).toEqual({ name: "Agent Project" });
  });

  it("rejects unsupported protocol versions", () => {
    const result = validateProtocolRequest({
      protocolVersion: 999,
      requestId: "req-1",
      command: "inspect",
      args: {}
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "INVALID_PROTOCOL",
        message: "Unsupported protocolVersion: 999"
      })
    );
  });

  it("rejects missing request ids", () => {
    const result = validateProtocolRequest({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      command: "inspect",
      args: {}
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "INVALID_PROTOCOL",
        message: "Missing requestId"
      })
    );
  });

  it("rejects unknown commands at the protocol boundary", () => {
    const result = validateProtocolRequest({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-1",
      command: "burn",
      args: {}
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_COMMAND",
        message: "Unknown command: burn"
      })
    );
  });

  it("dispatches inspect through the automation service", () => {
    const response = handleProtocolRequest(
      {
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: "req-inspect",
        command: "inspect",
        args: {}
      },
      job
    );

    expect(response).toMatchObject({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-inspect",
      ok: true,
      command: "inspect"
    });
    expect(response.data?.summary.document.objectCount).toBe(1);
  });

  it("dispatches generate through the automation service", () => {
    const response = handleProtocolRequest(
      {
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: "req-generate",
        command: "generate",
        args: {}
      },
      job
    );

    expect(response.ok).toBe(true);
    expect(response.command).toBe("generate");
    expect(response.data?.gcode).toContain("G1");
  });
});
