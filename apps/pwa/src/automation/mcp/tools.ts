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
    name: "laseryx_status",
    description: "Report MCP bridge configuration without sending a browser command.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
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
    name: "laseryx_project_new",
    description: "Reset the browser workspace to a new Laseryx project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
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
    name: "laseryx_project_export_json",
    description: "Export the current Laseryx browser project as JSON.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
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
    name: "laseryx_document_list_objects",
    description: "List objects in the current Laseryx document.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_document_update_transform",
    description: "Update transform fields for an object in the current Laseryx document.",
    inputSchema: {
      type: "object",
      properties: {
        object: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        rotation: { type: "number" },
        scaleX: { type: "number" },
        scaleY: { type: "number" }
      },
      required: ["object"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_document_delete_object",
    description: "Delete an object from the current Laseryx document.",
    inputSchema: {
      type: "object",
      properties: { object: { type: "string" } },
      required: ["object"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_cam_set_operation",
    description: "Update a CAM operation in the current Laseryx project.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string" },
        name: { type: "string" },
        mode: { type: "string" },
        speed: { type: "number" },
        power: { type: "number" },
        passes: { type: "number" }
      },
      required: ["operation"],
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

function commandForTool(name: string, args: Record<string, unknown>): { command: AutomationProtocolCommand; args: Record<string, unknown> } | null {
  switch (name) {
    case "laseryx_status":
      return null;
    case "laseryx_browser_run":
      return {
        command: requireString(args, "command") as AutomationProtocolCommand,
        args: asRecord(args.args)
      };
    case "laseryx_project_new":
      return { command: "project.new", args: {} };
    case "laseryx_project_list":
      return { command: "project.list", args: {} };
    case "laseryx_project_open":
      return { command: "project.open", args: { id: requireString(args, "id") } };
    case "laseryx_project_save":
      return { command: "project.save", args };
    case "laseryx_project_export_json":
      return { command: "project.exportJson", args: {} };
    case "laseryx_document_add_rect":
      return { command: "document.addRect", args };
    case "laseryx_document_list_objects":
      return { command: "document.listObjects", args: {} };
    case "laseryx_document_update_transform":
      return { command: "document.updateObjectTransform", args };
    case "laseryx_document_delete_object":
      return { command: "document.deleteObject", args: { object: requireString(args, "object") } };
    case "laseryx_cam_set_operation":
      return { command: "cam.setOperation", args };
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
    if (!mapped) {
      return textResult({
        ok: true,
        bridgeUrl: context.bridgeUrl,
        tokenConfigured: context.token.length > 0
      });
    }
    const postBrowserCommand = context.postBrowserCommand ?? defaultPostBrowserCommand;
    const response = await postBrowserCommand(context.bridgeUrl, context.token, mapped.command, mapped.args);
    return textResult(response, !response.ok);
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true);
  }
}
