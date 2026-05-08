import { callHostedMcpTool, listHostedMcpTools, type HostedMcpToolContext } from "./hostedMcp";
import { createHostedAgentSessionBroker, HostedAgentSessionError, type CreateHostedAgentSessionOptions } from "./broker";
import type { AgentPermission } from "./types";
import type { AutomationProtocolResponse } from "../protocol/types";

type JsonRpcId = string | number | null;

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
  };
};

export type HostedJsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export type HostedHttpContext = {
  broker?: ReturnType<typeof createHostedAgentSessionBroker>;
};

const sharedBroker = createHostedAgentSessionBroker();
const AGENT_PERMISSIONS = new Set<AgentPermission>(["read", "edit", "generate", "project-storage", "machine-control"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function responseId(request: Record<string, unknown> | null): JsonRpcId {
  if (!request || !("id" in request)) {
    return null;
  }
  const id = request.id;
  return typeof id === "string" || typeof id === "number" || id === null ? id : null;
}

function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

async function readJson(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }
  const text = await request.text();
  return text.trim() === "" ? {} : JSON.parse(text);
}

function hostedContextFromHeaders(request: Request, broker: ReturnType<typeof createHostedAgentSessionBroker>): HostedMcpToolContext | null {
  const sessionId = request.headers.get("x-laseryx-session-id");
  const agentToken = request.headers.get("x-laseryx-agent-token");
  if (!sessionId || !agentToken) {
    return null;
  }
  return { broker, sessionId, agentToken };
}

function sessionRequiredResult() {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ summary: { ok: false, code: "SESSION_REQUIRED", message: "Hosted session headers are required" } }, null, 2) }],
    isError: true,
    structuredContent: { summary: { ok: false, code: "SESSION_REQUIRED", message: "Hosted session headers are required" } }
  };
}

async function handleHostedMcpRequest(request: Request, broker: ReturnType<typeof createHostedAgentSessionBroker>): Promise<Response> {
  const rawRequest = await readJson(request);
  const rpc = asRecord(rawRequest);
  const id = responseId(rpc);

  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return jsonResponse(error(id, -32600, "Invalid Request"), 400);
  }

  if (!("id" in rpc)) {
    return new Response(null, { status: 204 });
  }

  switch (rpc.method) {
    case "initialize":
      return jsonResponse(success(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "laseryx-hosted-mcp", version: "1.0.0" },
        capabilities: { tools: {} }
      }));
    case "tools/list":
      return jsonResponse(success(id, { tools: listHostedMcpTools() }));
    case "tools/call": {
      const params = asRecord(rpc.params);
      if (!params || typeof params.name !== "string") {
        return jsonResponse(error(id, -32602, "Invalid params"), 400);
      }
      const context = hostedContextFromHeaders(request, broker);
      const result = context
        ? callHostedMcpTool(params.name, params.arguments, context)
        : sessionRequiredResult();
      return jsonResponse(success(id, result));
    }
    default:
      return jsonResponse(error(id, -32601, "Method not found"), 404);
  }
}

function pathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function parsePermissions(value: unknown): AgentPermission[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is AgentPermission => typeof item === "string" && AGENT_PERMISSIONS.has(item as AgentPermission));
}

function parseProtocolResponse(value: unknown): AutomationProtocolResponse {
  const response = asRecord(value);
  if (!response) {
    throw new HostedAgentSessionError("SESSION_INVALID_RESPONSE", "Browser response must be a protocol response object");
  }
  return response as AutomationProtocolResponse;
}

async function handleAgentSessionRequest(request: Request, broker: ReturnType<typeof createHostedAgentSessionBroker>): Promise<Response> {
  const url = new URL(request.url);
  const parts = pathParts(url);
  const body = asRecord(await readJson(request)) ?? {};

  if (request.method === "POST" && parts.length === 2) {
    const options: CreateHostedAgentSessionOptions = {};
    const permissions = parsePermissions(body.permissions);
    if (permissions) {
      options.permissions = permissions;
    }
    return jsonResponse({ session: broker.createSession(options) }, 201);
  }

  if (parts.length < 3 || parts[0] !== "agent" || parts[1] !== "session") {
    return jsonResponse({ ok: false, error: "Not found" }, 404);
  }

  const sessionId = parts[2];
  const action = parts[3];

  try {
    if (request.method === "GET" && parts.length === 3) {
      return jsonResponse({ status: broker.getSessionStatus(sessionId) });
    }
    if (request.method === "POST" && action === "claim") {
      return jsonResponse({
        claim: broker.claimSession({
          sessionId,
          pairingCode: String(body.pairingCode ?? ""),
          agentName: String(body.agentName ?? "Agent")
        })
      });
    }
    if (request.method === "POST" && action === "revoke") {
      return jsonResponse({ status: broker.revokeSession({ sessionId }) });
    }
    if (request.method === "POST" && action === "browser" && parts[4] === "attach") {
      return jsonResponse({ status: broker.attachBrowser({ sessionId, channelToken: String(body.channelToken ?? "") }) });
    }
    if (request.method === "POST" && action === "browser" && parts[4] === "detach") {
      return jsonResponse({ status: broker.detachBrowser({ sessionId, channelToken: String(body.channelToken ?? "") }) });
    }
    if (request.method === "GET" && action === "browser" && parts[4] === "next") {
      return jsonResponse({
        request: broker.nextBrowserCommand({ sessionId, channelToken: String(url.searchParams.get("channelToken") ?? "") })
      });
    }
    if (request.method === "POST" && action === "browser" && parts[4] === "response") {
      return jsonResponse({
        status: broker.acceptResponse({
          sessionId,
          channelToken: String(body.channelToken ?? ""),
          response: parseProtocolResponse(body.response)
        })
      });
    }
  } catch (caught) {
    if (caught instanceof HostedAgentSessionError) {
      return jsonResponse({ ok: false, code: caught.code, message: caught.message }, 400);
    }
    throw caught;
  }

  return jsonResponse({ ok: false, error: "Not found" }, 404);
}

export async function handleHostedHttpRequest(request: Request, context: HostedHttpContext = {}): Promise<Response> {
  const broker = context.broker ?? sharedBroker;
  const url = new URL(request.url);

  try {
    if (url.pathname === "/mcp") {
      return await handleHostedMcpRequest(request, broker);
    }
    if (url.pathname === "/agent/session" || url.pathname.startsWith("/agent/session/")) {
      return await handleAgentSessionRequest(request, broker);
    }
    return jsonResponse({ ok: false, error: "Not found" }, 404);
  } catch (caught) {
    return jsonResponse({
      ok: false,
      error: caught instanceof Error ? caught.message : String(caught)
    }, 500);
  }
}

export { sharedBroker as hostedAgentSessionBroker };
