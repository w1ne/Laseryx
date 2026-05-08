import { isAutomationCommand } from "../capabilities";
import { diagnostic, errorResponse } from "../responses";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolCommand,
  type AutomationProtocolRequest,
  type AutomationProtocolResponse
} from "../protocol/types";
import type { InAppAutomationBridge } from "./inAppBridge";

const LINK_PARAM = "lx";
const MAX_LINK_COMMAND_BYTES = 32_768;
const MAX_LINK_COMMANDS = 25;
export const BLOCKED_LINK_COMMANDS = new Set<string>([
  "project.save",
  "project.list",
  "project.open",
  "project.delete",
  "project.exportJson"
]);

export type LinkCommand = {
  command: AutomationProtocolCommand;
  args?: Record<string, unknown>;
};

export type LinkCommandCapsule = {
  version: 1;
  title?: string;
  commands: LinkCommand[];
};

export type LinkCommandParseResult =
  | { ok: true; capsule: LinkCommandCapsule }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chunkedStringFromBytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    chunks.push(String.fromCharCode(...bytes.slice(offset, offset + 4096)));
  }
  return chunks.join("");
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(chunkedStringFromBytes(bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function validateCapsule(value: unknown): LinkCommandParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Link command must be an object" };
  }
  if (value.version !== 1) {
    return { ok: false, error: `Unsupported link command version: ${String(value.version)}` };
  }
  if (value.title !== undefined && typeof value.title !== "string") {
    return { ok: false, error: "Link command title must be a string" };
  }
  if (!Array.isArray(value.commands) || value.commands.length === 0) {
    return { ok: false, error: "Link command must include at least one command" };
  }
  if (value.commands.length > MAX_LINK_COMMANDS) {
    return { ok: false, error: `Link command can include at most ${MAX_LINK_COMMANDS} commands` };
  }

  const commands: LinkCommand[] = [];
  for (const item of value.commands) {
    if (!isRecord(item) || typeof item.command !== "string") {
      return { ok: false, error: "Each link command must include a command name" };
    }
    if (!isAutomationCommand(item.command)) {
      return { ok: false, error: `Unknown command in link: ${item.command}` };
    }
    if (BLOCKED_LINK_COMMANDS.has(item.command)) {
      return { ok: false, error: `Command not allowed in links: ${item.command}` };
    }
    if (item.args !== undefined && !isRecord(item.args)) {
      return { ok: false, error: `Command args must be an object: ${item.command}` };
    }
    commands.push({
      command: item.command as AutomationProtocolCommand,
      args: item.args ? { ...item.args } : {}
    });
  }

  return {
    ok: true,
    capsule: {
      version: 1,
      ...(typeof value.title === "string" ? { title: value.title } : {}),
      commands
    }
  };
}

export function encodeLinkCommandCapsule(capsule: LinkCommandCapsule): string {
  return `#${LINK_PARAM}=${base64UrlEncode(JSON.stringify(capsule))}`;
}

export function readLinkCommandCapsuleFromHash(hash: string): LinkCommandParseResult {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalized);
  const encoded = params.get(LINK_PARAM);
  if (!encoded) {
    return { ok: false, error: "No link command found" };
  }
  if (encoded.length > MAX_LINK_COMMAND_BYTES) {
    return { ok: false, error: "Link command is too large" };
  }

  try {
    return validateCapsule(JSON.parse(base64UrlDecode(encoded)));
  } catch {
    return { ok: false, error: "Link command is not valid JSON" };
  }
}

export async function executeLinkCommandCapsule(
  capsule: LinkCommandCapsule,
  bridge: InAppAutomationBridge
): Promise<AutomationProtocolResponse[]> {
  const responses: AutomationProtocolResponse[] = [];
  for (const [index, command] of capsule.commands.entries()) {
    const request: AutomationProtocolRequest = {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: `link-${index + 1}`,
      command: command.command,
      args: command.args ?? {}
    };

    try {
      const response = await bridge.request(request);
      responses.push(response);
      if (!response.ok) break;
    } catch (error) {
      responses.push({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: request.requestId,
        ...errorResponse(request.command, [
          diagnostic("LINK_COMMAND_FAILED", "error", error instanceof Error ? error.message : String(error))
        ])
      } as AutomationProtocolResponse);
      break;
    }
  }
  return responses;
}
