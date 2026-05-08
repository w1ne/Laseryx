import { describe, expect, it } from "vitest";
import { createHostedAgentSessionBroker } from "./broker";
import { callHostedMcpTool, listHostedMcpTools } from "./hostedMcp";

function createClaimedSession(permissions = ["read", "edit", "generate"] as const) {
  const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
  const session = broker.createSession({ permissions: [...permissions] });
  broker.attachBrowser({ sessionId: session.sessionId, channelToken: session.channelToken });
  const claim = broker.claimSession({ sessionId: session.sessionId, pairingCode: session.pairingCode, agentName: "Codex" });
  return { broker, session, claim };
}

describe("hosted MCP tools", () => {
  it("lists the first hosted tool surface", () => {
    expect(listHostedMcpTools().map((tool) => tool.name)).toEqual([
      "laseryx_capabilities",
      "laseryx_session_status",
      "laseryx_project_summary",
      "laseryx_document_add_rect",
      "laseryx_generate"
    ]);
  });

  it("queues project summary, add rectangle, and generate commands", () => {
    const { broker, session, claim } = createClaimedSession();
    const context = { broker, sessionId: session.sessionId, agentToken: claim.agentToken };

    const summary = callHostedMcpTool("laseryx_project_summary", {}, context);
    const rect = callHostedMcpTool("laseryx_document_add_rect", { object: "rect-1", layer: "layer-1", width: 10, height: 20 }, context);
    const generate = callHostedMcpTool("laseryx_generate", { includeGcode: false }, context);

    expect(summary.structuredContent?.summary).toMatchObject({ queued: true, command: "project.summary" });
    expect(rect.structuredContent?.summary).toMatchObject({ queued: true, command: "document.addRect" });
    expect(generate.structuredContent?.summary).toMatchObject({ queued: true, command: "generate" });
  });

  it("returns session status and permission errors as structured results", () => {
    const { broker, session, claim } = createClaimedSession(["read"]);
    const context = { broker, sessionId: session.sessionId, agentToken: claim.agentToken };

    const status = callHostedMcpTool("laseryx_session_status", {}, context);
    const denied = callHostedMcpTool("laseryx_document_add_rect", { object: "rect-1", layer: "layer-1", width: 10, height: 20 }, context);

    expect(status.structuredContent?.summary).toMatchObject({ state: "connected", connectedAgentName: "Codex" });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent?.summary).toMatchObject({ code: "SESSION_PERMISSION_DENIED" });
  });
});
