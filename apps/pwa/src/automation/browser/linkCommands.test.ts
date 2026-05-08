import { describe, expect, it, vi } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import {
  encodeLinkCommandCapsule,
  executeLinkCommandCapsule,
  readLinkCommandCapsuleFromHash
} from "./linkCommands";

describe("link commands", () => {
  it("round-trips a command capsule through a URL fragment", () => {
    const hash = encodeLinkCommandCapsule({
      version: 1,
      title: "Test rectangle",
      commands: [
        {
          command: "document.addRect",
          args: { object: "rect-link-1", layer: "layer-1", x: 10, y: 12, width: 40, height: 20 }
        }
      ]
    });

    expect(readLinkCommandCapsuleFromHash(hash)).toEqual({
      ok: true,
      capsule: {
        version: 1,
        title: "Test rectangle",
        commands: [
          {
            command: "document.addRect",
            args: { object: "rect-link-1", layer: "layer-1", x: 10, y: 12, width: 40, height: 20 }
          }
        ]
      }
    });
  });

  it("rejects unsafe browser storage commands", () => {
    const hash = encodeLinkCommandCapsule({
      version: 1,
      commands: [{ command: "project.delete", args: { id: "local-project" } }]
    });

    expect(readLinkCommandCapsuleFromHash(hash)).toEqual({
      ok: false,
      error: "Command not allowed in links: project.delete"
    });
  });

  it("rejects oversized command fragments", () => {
    const hash = `#lx=${"a".repeat(40_000)}`;

    expect(readLinkCommandCapsuleFromHash(hash)).toEqual({
      ok: false,
      error: "Link command is too large"
    });
  });

  it("executes command batches through the automation bridge", async () => {
    const request = vi.fn().mockResolvedValue({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "link-1",
      ok: true,
      command: "document.addRect",
      data: {},
      warnings: [],
      errors: []
    });

    const responses = await executeLinkCommandCapsule(
      {
        version: 1,
        commands: [{ command: "document.addRect", args: { object: "rect-link-1", layer: "layer-1", width: 10, height: 10 } }]
      },
      { request }
    );

    expect(request).toHaveBeenCalledWith({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "link-1",
      command: "document.addRect",
      args: { object: "rect-link-1", layer: "layer-1", width: 10, height: 10 }
    });
    expect(responses).toHaveLength(1);
    expect(responses[0].ok).toBe(true);
  });
});
