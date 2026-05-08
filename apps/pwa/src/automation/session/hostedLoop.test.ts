import { describe, expect, it } from "vitest";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolCommand, type AutomationProtocolResponse } from "../protocol/types";
import { createHostedAgentSessionBroker } from "./broker";
import { callHostedMcpTool } from "./hostedMcp";

function protocolResponse(requestId: string, command: AutomationProtocolCommand): AutomationProtocolResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId,
    ok: true,
    command,
    data: { project: { id: "current", name: "Current", updatedAt: "2026-05-08T10:00:00.000Z" } },
    warnings: [],
    errors: []
  } as AutomationProtocolResponse;
}

describe("hosted agent loop", () => {
  it("runs the first release command loop and rejects commands after revoke", () => {
    const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
    const session = broker.createSession();
    broker.attachBrowser({ sessionId: session.sessionId, channelToken: session.channelToken });
    const claim = broker.claimSession({
      sessionId: session.sessionId,
      pairingCode: session.pairingCode,
      agentName: "Codex"
    });
    const context = { broker, sessionId: session.sessionId, agentToken: claim.agentToken };

    const summary = callHostedMcpTool("laseryx_project_summary", {}, context);
    const addRect = callHostedMcpTool("laseryx_document_add_rect", {
      object: "rect-agent-1",
      layer: "layer-1",
      x: 12,
      y: 18,
      width: 40,
      height: 25
    }, context);
    const generate = callHostedMcpTool("laseryx_generate", { includeGcode: false }, context);

    expect(summary.structuredContent?.summary).toMatchObject({ queued: true, command: "project.summary" });
    expect(addRect.structuredContent?.summary).toMatchObject({ queued: true, command: "document.addRect" });
    expect(generate.structuredContent?.summary).toMatchObject({ queued: true, command: "generate" });

    for (const command of ["project.summary", "document.addRect", "generate"] as const) {
      const request = broker.nextBrowserCommand({ sessionId: session.sessionId, channelToken: session.channelToken });
      expect(request).toMatchObject({ command });
      if (!request) {
        throw new Error(`Expected queued ${command} request`);
      }
      broker.acceptResponse({
        sessionId: session.sessionId,
        channelToken: session.channelToken,
        response: protocolResponse(request.requestId, command)
      });
    }

    expect(broker.nextBrowserCommand({ sessionId: session.sessionId, channelToken: session.channelToken })).toBeNull();
    expect(broker.revokeSession({ sessionId: session.sessionId }).state).toBe("revoked");

    const afterRevoke = callHostedMcpTool("laseryx_project_summary", {}, context);
    expect(afterRevoke).toMatchObject({
      isError: true,
      structuredContent: { summary: { code: "SESSION_REVOKED" } }
    });
  });
});
