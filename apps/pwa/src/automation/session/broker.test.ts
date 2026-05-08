import { describe, expect, it } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolResponse } from "../protocol/types";
import { createHostedAgentSessionBroker, HostedAgentSessionError } from "./broker";

function createClock(start = Date.parse("2026-05-08T10:00:00.000Z")) {
  let current = start;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    }
  };
}

function responseFor(requestId: string, command = "project.summary"): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId,
    ok: true,
    command,
    data: { project: { id: "current", name: "Current", updatedAt: "2026-05-08T10:00:00.000Z", summary: { objectCount: 0, operationCount: 0 } } },
    warnings: [],
    errors: []
  } as AutomationProtocolResponse;
}

describe("hosted agent session broker", () => {
  it("creates, claims, attaches, queues, responds, and revokes a session", () => {
    const clock = createClock();
    const broker = createHostedAgentSessionBroker({ now: clock.now, createId: () => "id-1" });
    const session = broker.createSession();

    expect(session.sessionId).toBe("session-id-1");
    expect(session.pairingCode).toBe("pair-id-1");
    expect(session.channelToken).toBe("channel-id-1");
    expect(session.snapshot.state).toBe("waiting");

    const browserStatus = broker.attachBrowser({ sessionId: session.sessionId, channelToken: session.channelToken });
    expect(browserStatus.browserAttached).toBe(true);

    const claim = broker.claimSession({ sessionId: session.sessionId, pairingCode: session.pairingCode, agentName: "Codex" });
    expect(claim.snapshot.state).toBe("connected");
    expect(claim.snapshot.connectedAgentName).toBe("Codex");

    const queued = broker.enqueueCommand({
      sessionId: session.sessionId,
      agentToken: claim.agentToken,
      command: "project.summary",
      args: {}
    });
    expect(queued.request.command).toBe("project.summary");
    expect(broker.nextBrowserCommand({ sessionId: session.sessionId, channelToken: session.channelToken })).toEqual(queued.request);

    const accepted = broker.acceptResponse({
      sessionId: session.sessionId,
      channelToken: session.channelToken,
      response: responseFor(queued.request.requestId)
    });
    expect(accepted.lastCommand?.ok).toBe(true);

    const revoked = broker.revokeSession({ sessionId: session.sessionId });
    expect(revoked.state).toBe("revoked");
    expect(() =>
      broker.enqueueCommand({ sessionId: session.sessionId, agentToken: claim.agentToken, command: "project.summary", args: {} })
    ).toThrowError(HostedAgentSessionError);
  });

  it("rejects expired sessions", () => {
    const clock = createClock();
    const broker = createHostedAgentSessionBroker({ now: clock.now, createId: () => "id-1", ttlMs: 1000 });
    const session = broker.createSession();
    const claim = broker.claimSession({ sessionId: session.sessionId, pairingCode: session.pairingCode, agentName: "Codex" });

    clock.advance(1001);

    expect(() =>
      broker.enqueueCommand({ sessionId: session.sessionId, agentToken: claim.agentToken, command: "project.summary", args: {} })
    ).toThrowError(/SESSION_EXPIRED/);
    expect(broker.getSessionStatus(session.sessionId).state).toBe("expired");
  });

  it("rejects commands without the required permission", () => {
    const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
    const session = broker.createSession({ permissions: ["read"] });
    broker.attachBrowser({ sessionId: session.sessionId, channelToken: session.channelToken });
    const claim = broker.claimSession({ sessionId: session.sessionId, pairingCode: session.pairingCode, agentName: "Codex" });

    expect(() =>
      broker.enqueueCommand({ sessionId: session.sessionId, agentToken: claim.agentToken, command: "document.addRect", args: {} })
    ).toThrowError(/SESSION_PERMISSION_DENIED/);
  });

  it("rejects commands when the browser is disconnected", () => {
    const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
    const session = broker.createSession();
    const claim = broker.claimSession({ sessionId: session.sessionId, pairingCode: session.pairingCode, agentName: "Codex" });

    expect(() =>
      broker.enqueueCommand({ sessionId: session.sessionId, agentToken: claim.agentToken, command: "project.summary", args: {} })
    ).toThrowError(/SESSION_BROWSER_DISCONNECTED/);
  });
});
