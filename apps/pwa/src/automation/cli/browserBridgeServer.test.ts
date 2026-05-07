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

  it("keeps command args on the queued protocol request", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });
    const pending = bridge.enqueueCommand("cam.setOperation", { operation: "op-1", power: 65 });
    const next = await bridge.takeNextCommand("dev");

    expect(next).toMatchObject({
      command: "cam.setOperation",
      args: { operation: "op-1", power: 65 }
    });

    bridge.acceptResponse("dev", {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: next?.requestId ?? "",
      ok: true,
      command: "cam.setOperation",
      data: { operation: { id: "op-1", power: 65 } },
      warnings: [],
      errors: []
    });
    await expect(pending).resolves.toMatchObject({ ok: true });
  });

  it("rejects a pending command when no browser response arrives before the timeout", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev", commandTimeoutMs: 5 });
    const pending = bridge.enqueueCommand("inspect", {});

    await expect(bridge.takeNextCommand("dev")).resolves.toMatchObject({ command: "inspect" });
    await expect(pending).rejects.toThrow("Timed out waiting for browser response");
  });

  it("does not lose commands after an empty browser poll times out", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev", pollTimeoutMs: 5 });

    await expect(bridge.takeNextCommand("dev")).resolves.toBeNull();

    const pending = bridge.enqueueCommand("inspect", {});
    const next = await bridge.takeNextCommand("dev");

    expect(next).toMatchObject({ command: "inspect" });
    bridge.acceptResponse("dev", {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: next?.requestId ?? "",
      ok: true,
      command: "inspect",
      data: { summary: { document: { objectCount: 0 } } },
      warnings: [],
      errors: []
    });
    await expect(pending).resolves.toMatchObject({ ok: true });
  });
});
