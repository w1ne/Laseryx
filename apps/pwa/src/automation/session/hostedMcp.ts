import type { AutomationProtocolCommand } from "../protocol/types";
import { automationCapabilities } from "../capabilities";
import type { McpToolDefinition, McpToolResult } from "../mcp/tools";
import { HostedAgentSessionError, type createHostedAgentSessionBroker } from "./broker";

type HostedBroker = ReturnType<typeof createHostedAgentSessionBroker>;

export type HostedMcpToolContext = {
  broker: HostedBroker;
  sessionId: string;
  agentToken: string;
};

const HOSTED_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "laseryx_capabilities",
    description: "List browser-backed Laseryx hosted automation capabilities.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_session_status",
    description: "Report the current hosted browser session status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_project_summary",
    description: "Queue a request to summarize the current browser project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_document_add_rect",
    description: "Queue a request to add a rectangle to the current browser document.",
    inputSchema: {
      type: "object",
      properties: {
        object: { type: "string" },
        layer: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["object", "layer", "width", "height"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_generate",
    description: "Queue a request to generate output for the current browser project.",
    inputSchema: {
      type: "object",
      properties: {
        includeGcode: { type: "boolean" }
      },
      additionalProperties: false
    }
  }
];

const HOSTED_CAPABILITY_COMMANDS = new Set(["automation.capabilities", "project.summary", "document.addRect", "generate"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function result(summary: Record<string, unknown>, isError = false): McpToolResult {
  const structuredContent = { summary };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError
  };
}

function errorResult(error: unknown): McpToolResult {
  if (error instanceof HostedAgentSessionError) {
    return result({ ok: false, code: error.code, message: error.message }, true);
  }
  return result({ ok: false, code: "HOSTED_MCP_ERROR", message: error instanceof Error ? error.message : String(error) }, true);
}

function commandForHostedTool(name: string, args: Record<string, unknown>): { command: AutomationProtocolCommand; args: Record<string, unknown> } | null {
  switch (name) {
    case "laseryx_capabilities":
    case "laseryx_session_status":
      return null;
    case "laseryx_project_summary":
      return { command: "project.summary", args: {} };
    case "laseryx_document_add_rect":
      return { command: "document.addRect", args };
    case "laseryx_generate":
      return {
        command: "generate",
        args: args.includeGcode === false ? { ...args, gcodePath: null } : args
      };
    default:
      throw new HostedAgentSessionError("HOSTED_MCP_UNKNOWN_TOOL", `Unknown hosted MCP tool ${name}`);
  }
}

export function listHostedMcpTools(): McpToolDefinition[] {
  return HOSTED_TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: tool.inputSchema.properties ? { ...tool.inputSchema.properties } : undefined,
      required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined
    }
  }));
}

export function callHostedMcpTool(name: string, rawArgs: unknown, context: HostedMcpToolContext): McpToolResult {
  try {
    const args = asRecord(rawArgs);
    const mapped = commandForHostedTool(name, args);
    if (!mapped) {
      if (name === "laseryx_capabilities") {
        return result({
          ok: true,
          capabilities: automationCapabilities().filter((capability) => HOSTED_CAPABILITY_COMMANDS.has(capability.command))
        });
      }
      return result({
        ok: true,
        ...context.broker.getSessionStatus(context.sessionId)
      });
    }
    const queued = context.broker.enqueueCommand({
      sessionId: context.sessionId,
      agentToken: context.agentToken,
      command: mapped.command,
      args: mapped.args
    });
    return result({
      ok: true,
      queued: true,
      requestId: queued.request.requestId,
      command: queued.request.command
    });
  } catch (error) {
    return errorResult(error);
  }
}
