import { describe, expect, it, vi } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolRequest, type AutomationProtocolResponse } from "../protocol/types";
import type { InAppAutomationBridge } from "../browser/inAppBridge";
import {
  createBrowserAgentSessionClient,
  type BrowserAgentSessionTransport,
  type HostedAgentSessionCreated
} from "./browserSessionClient";

function request(command = "project.summary"): AutomationProtocolRequest {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: "req-1",
    command,
    args: {}
  } as AutomationProtocolRequest;
}

function okResponse(input: AutomationProtocolRequest): AutomationProtocolResponse {
  return {
    protocolVersion: input.protocolVersion,
    requestId: input.requestId,
    ok: true,
    command: input.command,
    data: { jobSummary: { document: { objectCount: 0 }, cam: { operationCount: 1 }, machine: { id: "default" } } },
    warnings: [],
    errors: []
  } as AutomationProtocolResponse;
}

function createTransport(): BrowserAgentSessionTransport {
  return {
    createSession: vi.fn(async () => ({
      sessionId: "session-1",
      pairingCode: "LASER-123",
      channelToken: "channel-token",
      expiresAt: "2026-05-08T10:00:00.000Z"
    } satisfies HostedAgentSessionCreated)),
    connectChannel: vi.fn(async (_session, handlers) => {
      return {
        close: vi.fn(),
        emitRequest: (input: AutomationProtocolRequest) => handlers.onRequest(input),
        emitStatus: handlers.onStatus
      };
    }),
    sendProtocolResponse: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined)
  };
}

describe("browser agent session client", () => {
  it("creates a waiting session with default permissions", async () => {
    const transport = createTransport();
    const bridge: InAppAutomationBridge = { request: vi.fn(async (input) => okResponse(input)) };
    const client = createBrowserAgentSessionClient({ transport, bridge });

    const snapshot = await client.createSession();

    expect(transport.createSession).toHaveBeenCalledWith(["read", "edit", "generate"]);
    expect(snapshot).toEqual({
      sessionId: "session-1",
      state: "waiting",
      permissions: ["read", "edit", "generate"],
      expiresAt: "2026-05-08T10:00:00.000Z",
      connectedAgentName: null,
      lastCommand: null
    });
  });

  it("notifies subscribers when session status changes", async () => {
    const transport = createTransport();
    const bridge: InAppAutomationBridge = { request: vi.fn(async (input) => okResponse(input)) };
    const client = createBrowserAgentSessionClient({ transport, bridge });
    const seen = vi.fn();

    const unsubscribe = client.subscribeStatus(seen);
    await client.createSession();

    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({
      sessionId: "session-1",
      state: "waiting"
    }));
    unsubscribe();
  });

  it("connects the channel and sends protocol responses from the in-app bridge", async () => {
    const transport = createTransport();
    const bridge: InAppAutomationBridge = { request: vi.fn(async (input) => okResponse(input)) };
    const client = createBrowserAgentSessionClient({ transport, bridge });
    await client.createSession();

    const channel = await client.connectChannel();
    await channel.emitRequest(request());

    expect(transport.connectChannel).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1" }), expect.any(Object));
    expect(bridge.request).toHaveBeenCalledWith(request());
    expect(transport.sendProtocolResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        channelToken: "channel-token"
      }),
      okResponse(request())
    );
    expect(client.getSnapshot().lastCommand).toEqual({
      requestId: "req-1",
      command: "project.summary",
      ok: true,
      startedAt: expect.any(String),
      completedAt: expect.any(String)
    });
  });

  it("sends protocol-shaped errors when the bridge throws", async () => {
    const transport = createTransport();
    const bridge: InAppAutomationBridge = { request: vi.fn(() => { throw new Error("bridge exploded"); }) };
    const client = createBrowserAgentSessionClient({ transport, bridge });
    await client.createSession();

    const channel = await client.connectChannel();
    await channel.emitRequest(request("document.addRect"));

    expect(transport.sendProtocolResponse).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-1",
      ok: false,
      command: "document.addRect",
      data: null,
      errors: [expect.objectContaining({
        code: "SESSION_BRIDGE_REQUEST_FAILED",
        message: "bridge exploded"
      })]
    }));
  });

  it("disconnects the active channel and revokes the session", async () => {
    const transport = createTransport();
    const bridge: InAppAutomationBridge = { request: vi.fn(async (input) => okResponse(input)) };
    const client = createBrowserAgentSessionClient({ transport, bridge });
    await client.createSession();
    const channel = await client.connectChannel();

    await client.disconnect();

    expect(channel.close).toHaveBeenCalled();
    expect(transport.disconnect).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      channelToken: "channel-token"
    }));
    expect(client.getSnapshot()).toMatchObject({
      sessionId: "session-1",
      state: "revoked"
    });
  });
});
