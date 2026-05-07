import { describe, expect, it, vi } from "vitest";
import type { AutomationProtocolResponse } from "../protocol/types";
import { handleMcpRequest, type McpRequestContext } from "./server";

const okResponse: AutomationProtocolResponse = {
  protocolVersion: 1,
  requestId: "req-1",
  ok: true,
  command: "project.list",
  data: { projects: [] },
  warnings: [],
  errors: []
};

function createContext(): McpRequestContext {
  return {
    bridgeUrl: "http://127.0.0.1:17321",
    token: "dev",
    postBrowserCommand: vi.fn(async () => okResponse)
  };
}

describe("mcp json-rpc server", () => {
  it("initializes with Laseryx server metadata and tool capability", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, createContext());

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "laseryx-mcp", version: "1.0.0" },
        capabilities: { tools: {} }
      }
    });
  });

  it("lists MCP tools", async () => {
    const response = await handleMcpRequest({ jsonrpc: "2.0", id: "tools", method: "tools/list" }, createContext());

    expect(response?.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "laseryx_status",
      "laseryx_bridge_status",
      "laseryx_browser_run",
      "laseryx_project_new",
      "laseryx_project_list",
      "laseryx_project_open",
      "laseryx_project_save",
      "laseryx_project_export_json",
      "laseryx_project_import_json",
      "laseryx_project_delete",
      "laseryx_document_add_rect",
      "laseryx_document_list_objects",
      "laseryx_document_update_transform",
      "laseryx_document_delete_object",
      "laseryx_cam_set_operation",
      "laseryx_generate"
    ]);
  });

  it("calls MCP tools through the browser protocol", async () => {
    const context = createContext();
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: "call",
      method: "tools/call",
      params: { name: "laseryx_project_list", arguments: {} }
    }, context);

    expect(context.postBrowserCommand).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev", "project.list", {});
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "call",
      result: { isError: false }
    });
    expect(JSON.parse(response?.result.content[0].text)).toEqual(okResponse);
  });

  it("returns json-rpc errors for invalid requests and unknown methods", async () => {
    await expect(handleMcpRequest({ jsonrpc: "2.0", id: 1 }, createContext())).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600 }
    });

    await expect(handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "missing" }, createContext())).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601 }
    });
  });

  it("does not answer notifications", async () => {
    await expect(handleMcpRequest({ jsonrpc: "2.0", method: "notifications/initialized" }, createContext())).resolves.toBeNull();
  });
});
