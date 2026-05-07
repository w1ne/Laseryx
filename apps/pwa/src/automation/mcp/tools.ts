import type { AutomationProtocolCommand, AutomationProtocolResponse } from "../protocol/types";
import { postBrowserCommand as defaultPostBrowserCommand } from "../cli/browserBridgeServer";

type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type BrowserCommandPoster = (
  bridgeUrl: string,
  token: string,
  command: AutomationProtocolCommand,
  args: Record<string, unknown>
) => Promise<AutomationProtocolResponse>;

export type McpToolContext = {
  bridgeUrl: string;
  token: string;
  postBrowserCommand?: BrowserCommandPoster;
};

const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "laseryx_browser_run",
    description: "Run any Laseryx browser automation protocol command through the configured local bridge.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        args: { type: "object", additionalProperties: true }
      },
      required: ["command"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_project_list",
    description: "List saved Laseryx browser projects.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_project_open",
    description: "Open a saved Laseryx browser project by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_project_save",
    description: "Save the current Laseryx browser project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "laseryx_document_add_rect",
    description: "Add a rectangle to the current Laseryx document.",
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
    description: "Generate output for the current Laseryx browser project.",
    inputSchema: {
      type: "object",
      properties: {
        includeGcode: { type: "boolean" }
      },
      additionalProperties: false
    }
  }
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textResult(value: unknown, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    isError
  };
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function commandForTool(name: string, args: Record<string, unknown>): { command: AutomationProtocolCommand; args: Record<string, unknown> } {
  switch (name) {
    case "laseryx_browser_run":
      return {
        command: requireString(args, "command") as AutomationProtocolCommand,
        args: asRecord(args.args)
      };
    case "laseryx_project_list":
      return { command: "project.list", args: {} };
    case "laseryx_project_open":
      return { command: "project.open", args: { id: requireString(args, "id") } };
    case "laseryx_project_save":
      return { command: "project.save", args };
    case "laseryx_document_add_rect":
      return { command: "document.addRect", args };
    case "laseryx_generate":
      return { command: "generate", args };
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export function listMcpTools(): McpToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export async function callMcpTool(name: string, rawArgs: unknown, context: McpToolContext): Promise<McpToolResult> {
  try {
    const args = asRecord(rawArgs);
    const mapped = commandForTool(name, args);
    const postBrowserCommand = context.postBrowserCommand ?? defaultPostBrowserCommand;
    const response = await postBrowserCommand(context.bridgeUrl, context.token, mapped.command, mapped.args);
    return textResult(response, !response.ok);
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true);
  }
}
