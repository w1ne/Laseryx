import { callMcpTool, listMcpTools, type BrowserCommandPoster } from "./tools";

export type McpRequestContext = {
  bridgeUrl: string;
  token: string;
  postBrowserCommand?: BrowserCommandPoster;
};

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

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

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

export async function handleMcpRequest(rawRequest: unknown, context: McpRequestContext): Promise<JsonRpcResponse | null> {
  const request = asRecord(rawRequest);
  const id = responseId(request);

  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return error(id, -32600, "Invalid Request");
  }

  if (!("id" in request)) {
    return null;
  }

  switch (request.method) {
    case "initialize":
      return success(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "laseryx-mcp", version: "1.0.0" },
        capabilities: { tools: {} }
      });
    case "tools/list":
      return success(id, { tools: listMcpTools() });
    case "tools/call": {
      const params = asRecord(request.params);
      if (!params || typeof params.name !== "string") {
        return error(id, -32602, "Invalid params");
      }
      return success(id, await callMcpTool(params.name, params.arguments, context));
    }
    default:
      return error(id, -32601, "Method not found");
  }
}
