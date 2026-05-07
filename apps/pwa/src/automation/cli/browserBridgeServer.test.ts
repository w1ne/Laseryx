import { describe, expect, it } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import { LocalBrowserBridgeServer } from "./browserBridgeServer";

describe("LocalBrowserBridgeServer", () => {
  it("delivers an enqueued command to the browser and resolves with its response", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });
    const pending = bridge.enqueueCommand("inspect", {});
    const next = await bridge.takeNextCommand("dev");

    expect(next).toMatchObject({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      command: "inspect"
    });

    bridge.acceptResponse("dev", {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: next?.requestId ?? "",
      ok: true,
      command: "inspect",
      data: { summary: { document: { objectCount: 0 } } },
      warnings: [],
      errors: []
    });

    await expect(pending).resolves.toMatchObject({
      ok: true,
      requestId: next?.requestId,
      command: "inspect"
    });
  });

  it("rejects commands with invalid tokens", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });

    await expect(bridge.takeNextCommand("wrong")).rejects.toThrow("Invalid bridge token");
  });
});
