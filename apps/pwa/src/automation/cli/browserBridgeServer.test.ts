import { describe, expect, it } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import { LocalBrowserBridgeServer, postBrowserCommand } from "./browserBridgeServer";

describe("LocalBrowserBridgeServer", () => {
  it("reports bridge lifecycle status for detached, waiting, busy, and idle states", async () => {
    let now = 1_000;
    const bridge = new LocalBrowserBridgeServer({
      token: "dev",
      commandTimeoutMs: 500,
      browserStaleMs: 100,
      now: () => now
    });

    expect(bridge.getStatus()).toMatchObject({
      ok: true,
      attached: false,
      state: "detached",
      pendingCount: 0,
      inFlightCount: 0,
      lastBrowserPollAt: null,
      lastBrowserResponseAt: null
    });

    const pending = bridge.enqueueCommand("inspect", {});
    expect(bridge.getStatus()).toMatchObject({
      attached: false,
      state: "waiting",
      pendingCount: 1,
      inFlightCount: 0
    });

    const next = await bridge.takeNextCommand("dev");
    expect(bridge.getStatus()).toMatchObject({
      attached: true,
      state: "busy",
      pendingCount: 0,
      inFlightCount: 1,
      lastBrowserPollAt: 1_000
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
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(bridge.getStatus()).toMatchObject({
      attached: true,
      state: "idle",
      lastBrowserResponseAt: 1_000
    });

    now = 1_200;
    expect(bridge.getStatus()).toMatchObject({
      attached: false,
      state: "detached"
    });
  });

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

  it("rejects a queued command when no browser polls before the timeout", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev", commandTimeoutMs: 5 });
    const pending = bridge.enqueueCommand("inspect", {});

    await expect(pending).rejects.toThrow("Timed out waiting for browser response");
  });

  it("does not time out queued commands while another command is in flight", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev", commandTimeoutMs: 20 });
    const first = bridge.enqueueCommand("inspect", {});
    const second = bridge.enqueueCommand("project.list", {});
    second.catch(() => undefined);

    const firstRequest = await bridge.takeNextCommand("dev");
    await new Promise((resolve) => setTimeout(resolve, 15));
    bridge.acceptResponse("dev", {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: firstRequest?.requestId ?? "",
      ok: true,
      command: "inspect",
      data: { summary: { document: { objectCount: 0 } } },
      warnings: [],
      errors: []
    });
    await expect(first).resolves.toMatchObject({ ok: true });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const secondRequest = await bridge.takeNextCommand("dev");
    expect(secondRequest).toMatchObject({ command: "project.list" });
    bridge.acceptResponse("dev", {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: secondRequest?.requestId ?? "",
      ok: true,
      command: "project.list",
      data: { projects: [] },
      warnings: [],
      errors: []
    });
    await expect(second).resolves.toMatchObject({ ok: true });
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

  it("reports HTTP bridge error status and body to command callers", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev", commandTimeoutMs: 5 });
    const server = bridge.createHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const bridgeUrl = `http://127.0.0.1:${address.port}`;

    try {
      await expect(postBrowserCommand(bridgeUrl, "wrong", "inspect", {}))
        .rejects.toThrow("Bridge command failed: 401 Invalid bridge token");

      const badRequest = await fetch(`${bridgeUrl}/command?token=dev`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      expect(badRequest.status).toBe(400);
      await expect(badRequest.json()).resolves.toMatchObject({
        ok: false,
        error: "Missing command"
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it("serves bridge status over HTTP", async () => {
    const bridge = new LocalBrowserBridgeServer({ token: "dev" });
    const server = bridge.createHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const bridgeUrl = `http://127.0.0.1:${address.port}`;

    try {
      const response = await fetch(`${bridgeUrl}/status?token=dev`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        attached: false,
        state: "detached",
        pendingCount: 0,
        inFlightCount: 0
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
