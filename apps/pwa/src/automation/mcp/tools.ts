import type { AutomationProtocolCommand, AutomationProtocolResponse } from "../protocol/types";
import { fetchBridgeStatus as defaultFetchBridgeStatus, postBrowserCommand as defaultPostBrowserCommand, type BrowserBridgeStatus } from "../cli/browserBridgeServer";
import { automationCapabilities } from "../capabilities";

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
  structuredContent?: Record<string, unknown>;
};

export type BrowserCommandPoster = (
  bridgeUrl: string,
  token: string,
  command: AutomationProtocolCommand,
  args: Record<string, unknown>
) => Promise<AutomationProtocolResponse>;

export type BridgeStatusReader = (
  bridgeUrl: string,
  token: string
) => Promise<BrowserBridgeStatus>;

export type McpToolContext = {
  bridgeUrl: string;
  token: string;
  postBrowserCommand?: BrowserCommandPoster;
  postBridgeStatus?: BridgeStatusReader;
};

const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "laseryx_status",
    description: "Report MCP bridge configuration without sending a browser command.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_bridge_status",
    description: "Report live local browser bridge lifecycle status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_capabilities",
    description: "List supported Laseryx automation commands and their metadata.",
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
    name: "laseryx_project_summary",
    description: "Summarize the current Laseryx browser project without exporting full JSON.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_project_export_json",
    description: "Export the current Laseryx browser project as JSON.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "laseryx_project_import_json",
    description: "Import a Laseryx project JSON object into the browser workspace.",
    inputSchema: {
      type: "object",
      properties: {
        job: { type: "object", additionalProperties: true }
      },
      required: ["job"],
      additionalProperties: false
    }
  },
  {
    name: "laseryx_project_delete",
    description: "Delete a saved Laseryx browser project by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
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
        scaleY: { type: "number" },
        dryRun: { type: "boolean" }
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
      properties: { object: { type: "string" }, dryRun: { type: "boolean" } },
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
        passes: { type: "number" },
        dryRun: { type: "boolean" }
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

function maybeRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayLength(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function summarizeJob(job: unknown): Record<string, unknown> | undefined {
  const jobRecord = maybeRecord(job);
  const document = maybeRecord(jobRecord?.document);
  const camSettings = maybeRecord(jobRecord?.camSettings);
  if (!document && !camSettings) {
    return undefined;
  }
  return {
    objectCount: arrayLength(document?.objects) ?? 0,
    layerCount: arrayLength(document?.layers) ?? 0,
    operationCount: arrayLength(camSettings?.operations) ?? 0
  };
}

function summarizeResponse(response: AutomationProtocolResponse): Record<string, unknown> | null {
  const data = maybeRecord(response.data);
  const base = { command: response.command, ok: response.ok };
  if (!data) {
    return null;
  }

  if (response.command === "generate") {
    const summary = maybeRecord(data.summary);
    const document = maybeRecord(summary?.document);
    const cam = maybeRecord(summary?.cam);
    const preview = maybeRecord(data.preview);
    const stats = maybeRecord(data.stats);
    return {
      ...base,
      objectCount: document?.objectCount,
      operationCount: cam?.operationCount,
      bbox: preview?.bbox,
      estTimeS: stats?.estTimeS,
      gcodeIncluded: typeof data.gcode === "string" && data.gcode.length > 0
    };
  }

  if (response.command === "document.listObjects") {
    return {
      ...base,
      objectCount: arrayLength(data.objects) ?? 0,
      objects: Array.isArray(data.objects) ? data.objects : [],
      selectedObjectId: data.selectedObjectId ?? null
    };
  }

  if (response.command === "cam.setOperation") {
    return { ...base, operation: data.operation };
  }

  if ("project" in data) {
    return { ...base, project: data.project };
  }

  if ("projects" in data) {
    return {
      ...base,
      projectCount: arrayLength(data.projects) ?? 0,
      projects: Array.isArray(data.projects) ? data.projects : []
    };
  }

  if ("jobSummary" in data) {
    return {
      ...base,
      jobSummary: data.jobSummary
    };
  }

  if ("job" in data) {
    return {
      ...base,
      job: summarizeJob(data.job)
    };
  }

  if ("deletedProjectId" in data) {
    return { ...base, deletedProjectId: data.deletedProjectId };
  }

  return null;
}

function protocolResult(response: AutomationProtocolResponse): McpToolResult {
  const content = [{ type: "text" as const, text: JSON.stringify(response, null, 2) }];
  const summary = summarizeResponse(response);
  if (summary) {
    const structuredContent = { summary };
    content.push({ type: "text", text: JSON.stringify(structuredContent, null, 2) });
    return { content, structuredContent, isError: !response.ok };
  }
  return { content, isError: !response.ok };
}

function structuredSummaryResult(summary: Record<string, unknown>, isError = false): McpToolResult {
  const structuredContent = { summary };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
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
    case "laseryx_bridge_status":
      return null;
    case "laseryx_capabilities":
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
    case "laseryx_project_summary":
      return { command: "project.summary", args: {} };
    case "laseryx_project_export_json":
      return { command: "project.exportJson", args: {} };
    case "laseryx_project_import_json":
      if (!maybeRecord(args.job)) {
        throw new Error("job must be a project JSON object");
      }
      return { command: "project.importJson", args: { job: args.job } };
    case "laseryx_project_delete":
      return { command: "project.delete", args: { id: requireString(args, "id") } };
    case "laseryx_document_add_rect":
      return { command: "document.addRect", args };
    case "laseryx_document_list_objects":
      return { command: "document.listObjects", args: {} };
    case "laseryx_document_update_transform":
      return { command: "document.updateObjectTransform", args };
    case "laseryx_document_delete_object":
      return {
        command: "document.deleteObject",
        args: {
          object: requireString(args, "object"),
          ...(args.dryRun === true ? { dryRun: true } : {})
        }
      };
    case "laseryx_cam_set_operation":
      return { command: "cam.setOperation", args };
    case "laseryx_generate":
      return {
        command: "generate",
        args: args.includeGcode === false ? { ...args, gcodePath: null } : args
      };
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
      if (name === "laseryx_capabilities") {
        return textResult({
          ok: true,
          capabilities: automationCapabilities()
        });
      }
      if (name === "laseryx_bridge_status") {
        const postBridgeStatus = context.postBridgeStatus ?? defaultFetchBridgeStatus;
        const status = await postBridgeStatus(context.bridgeUrl, context.token);
        return structuredSummaryResult(status);
      }
      return textResult({
        ok: true,
        bridgeUrl: context.bridgeUrl,
        tokenConfigured: context.token.length > 0
      });
    }
    const postBrowserCommand = context.postBrowserCommand ?? defaultPostBrowserCommand;
    const response = await postBrowserCommand(context.bridgeUrl, context.token, mapped.command, mapped.args);
    return protocolResult(response);
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true);
  }
}
