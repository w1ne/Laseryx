import type { AgentCommand } from "../types";

type ParsedArgs =
  | { ok: true; command: AgentCommand; inputPath: string; gcodeOut?: string; includeGcode: boolean }
  | { ok: false; message: string };

const COMMANDS = new Set(["inspect", "preflight", "generate"]);

export function parseCliArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command || !COMMANDS.has(command)) {
    return { ok: false, message: `Unknown command: ${command ?? ""}`.trim() };
  }

  let inputPath: string | undefined;
  let gcodeOut: string | undefined;
  let includeGcode = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--input") {
      inputPath = rest[index + 1];
      index += 1;
    } else if (arg === "--gcode-out") {
      gcodeOut = rest[index + 1];
      index += 1;
    } else if (arg === "--include-gcode") {
      includeGcode = true;
    } else {
      return { ok: false, message: `Unknown option: ${arg}` };
    }
  }

  if (!inputPath) {
    return { ok: false, message: "Missing --input" };
  }

  return { ok: true, command: command as AgentCommand, inputPath, gcodeOut, includeGcode };
}
