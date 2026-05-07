import { generateCommand, type GenerateCommandOptions } from "./commands/generate";
import { inspectCommand } from "./commands/inspect";
import { preflightCommand } from "./commands/preflight";
import { diagnostic, errorResponse } from "./responses";
import type { AgentCommand, AgentResponse, GenerateData, InspectData, PreflightData } from "./types";

export type RunAgentCommandOptions = GenerateCommandOptions;

export function runAgentCommand(
  command: string,
  input: unknown,
  options: RunAgentCommandOptions = {}
): AgentResponse<InspectData | PreflightData | GenerateData> {
  switch (command as AgentCommand) {
    case "inspect":
      return inspectCommand(input);
    case "preflight":
      return preflightCommand(input);
    case "generate":
      return generateCommand(input, options);
    default:
      return errorResponse("inspect", [
        diagnostic("UNKNOWN_COMMAND", "error", `Unknown command: ${command}`)
      ]);
  }
}
