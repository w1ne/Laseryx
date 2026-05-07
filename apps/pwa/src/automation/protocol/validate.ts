import { diagnostic } from "../responses";
import type { AgentCommand } from "../types";
import {
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationProtocolRequest,
  type AutomationProtocolValidationResult
} from "./types";

const SUPPORTED_COMMANDS = new Set<AgentCommand>(["inspect", "preflight", "generate"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProtocolRequest(input: unknown): AutomationProtocolValidationResult {
  const errors = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      request: null,
      errors: [diagnostic("INVALID_PROTOCOL", "error", "Request must be an object")]
    };
  }

  if (input.protocolVersion !== AUTOMATION_PROTOCOL_VERSION) {
    errors.push(
      diagnostic("INVALID_PROTOCOL", "error", `Unsupported protocolVersion: ${String(input.protocolVersion)}`)
    );
  }

  if (typeof input.requestId !== "string" || input.requestId.length === 0) {
    errors.push(diagnostic("INVALID_PROTOCOL", "error", "Missing requestId"));
  }

  if (typeof input.command !== "string" || input.command.length === 0) {
    errors.push(diagnostic("INVALID_PROTOCOL", "error", "Missing command"));
  } else if (!SUPPORTED_COMMANDS.has(input.command as AgentCommand)) {
    errors.push(diagnostic("UNKNOWN_COMMAND", "error", `Unknown command: ${input.command}`));
  }

  if (errors.length > 0) {
    return { ok: false, request: null, errors };
  }

  return {
    ok: true,
    request: {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: input.requestId as string,
      command: input.command as AgentCommand,
      args: isRecord(input.args) ? input.args : {}
    } as AutomationProtocolRequest,
    errors: []
  };
}
