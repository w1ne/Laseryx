import { describe, expect, it } from "vitest";
import { runAgentCommand } from "./agentApi";
import minimalJob from "./fixtures/minimal-job.json";

describe("runAgentCommand", () => {
  it("dispatches inspect", () => {
    const response = runAgentCommand("inspect", minimalJob);

    expect(response.ok).toBe(true);
    expect(response.command).toBe("inspect");
  });

  it("returns a structured error for unknown commands", () => {
    const response = runAgentCommand("unknown", minimalJob);

    expect(response.ok).toBe(false);
    expect(response.command).toBe("inspect");
    expect(response.errors).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_COMMAND",
        severity: "error",
        message: "Unknown command: unknown"
      })
    );
  });
});
