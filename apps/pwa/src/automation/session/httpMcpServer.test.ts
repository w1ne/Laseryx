import { describe, expect, it } from "vitest";
import { createHostedAgentSessionBroker } from "./broker";
import { handleHostedHttpRequest } from "./httpMcpServer";

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function createRequest(path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://laseryx.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function createClaimedSession(permissions?: string[]) {
  const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
  const createResponse = await handleHostedHttpRequest(createRequest("/agent/session", permissions ? { permissions } : {}), { broker });
  const created = await json(createResponse);
  const session = created.session as Record<string, string>;

  await handleHostedHttpRequest(
    createRequest(`/agent/session/${session.sessionId}/browser/attach`, { channelToken: session.channelToken }),
    { broker }
  );
  const claimResponse = await handleHostedHttpRequest(
    createRequest(`/agent/session/${session.sessionId}/claim`, { pairingCode: session.pairingCode, agentName: "Codex" }),
    { broker }
  );
  const claim = await json(claimResponse);
  return { broker, session, claim: claim.claim as Record<string, string> };
}

describe("hosted HTTP MCP adapter", () => {
  it("handles MCP initialize and tool discovery on /mcp", async () => {
    const broker = createHostedAgentSessionBroker();
    const initialize = await handleHostedHttpRequest(
      createRequest("/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      { broker }
    );
    const tools = await handleHostedHttpRequest(createRequest("/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" }), { broker });

    await expect(json(initialize)).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { serverInfo: { name: "laseryx-hosted-mcp" }, capabilities: { tools: {} } }
    });
    const toolBody = await json(tools);
    expect((toolBody.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)).toEqual([
      "laseryx_capabilities",
      "laseryx_session_status",
      "laseryx_project_summary",
      "laseryx_document_add_rect",
      "laseryx_generate"
    ]);
  });

  it("creates, claims, and attaches same-origin browser sessions", async () => {
    const broker = createHostedAgentSessionBroker({ createId: () => "id-1" });
    const createResponse = await handleHostedHttpRequest(createRequest("/agent/session", {}), { broker });
    const created = await json(createResponse);
    const session = created.session as Record<string, string>;

    expect(createResponse.status).toBe(201);
    expect(session.sessionId).toBe("session-id-1");
    expect(session.pairingCode).toBe("pair-id-1");
    expect(session.channelToken).toBe("channel-id-1");

    const attachResponse = await handleHostedHttpRequest(
      createRequest(`/agent/session/${session.sessionId}/browser/attach`, { channelToken: session.channelToken }),
      { broker }
    );
    const claimResponse = await handleHostedHttpRequest(
      createRequest(`/agent/session/${session.sessionId}/claim`, { pairingCode: session.pairingCode, agentName: "Codex" }),
      { broker }
    );

    await expect(json(attachResponse)).resolves.toMatchObject({ status: { browserAttached: true } });
    await expect(json(claimResponse)).resolves.toMatchObject({ claim: { snapshot: { state: "connected", connectedAgentName: "Codex" } } });
  });

  it("queues hosted MCP tool calls for active sessions", async () => {
    const { broker, session, claim } = await createClaimedSession();
    const response = await handleHostedHttpRequest(
      createRequest(
        "/mcp",
        {
          jsonrpc: "2.0",
          id: "call",
          method: "tools/call",
          params: { name: "laseryx_project_summary", arguments: {} }
        },
        { "x-laseryx-session-id": session.sessionId, "x-laseryx-agent-token": claim.agentToken }
      ),
      { broker }
    );

    await expect(json(response)).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: "call",
      result: { isError: false, structuredContent: { summary: { queued: true, command: "project.summary" } } }
    });
  });

  it("returns structured permission denied and no active session errors", async () => {
    const { broker, session, claim } = await createClaimedSession(["read"]);
    const denied = await handleHostedHttpRequest(
      createRequest(
        "/mcp",
        { jsonrpc: "2.0", id: "denied", method: "tools/call", params: { name: "laseryx_document_add_rect", arguments: {} } },
        { "x-laseryx-session-id": session.sessionId, "x-laseryx-agent-token": claim.agentToken }
      ),
      { broker }
    );
    const missing = await handleHostedHttpRequest(
      createRequest("/mcp", { jsonrpc: "2.0", id: "missing", method: "tools/call", params: { name: "laseryx_project_summary", arguments: {} } }),
      { broker }
    );

    await expect(json(denied)).resolves.toMatchObject({
      result: { isError: true, structuredContent: { summary: { code: "SESSION_PERMISSION_DENIED" } } }
    });
    await expect(json(missing)).resolves.toMatchObject({
      result: { isError: true, structuredContent: { summary: { code: "SESSION_REQUIRED" } } }
    });
  });
});
