import type { AgentCommand } from "../types";

type ParsedArgs =
  | { ok: true; mode: "file"; command: AgentCommand; inputPath: string; gcodeOut?: string; includeGcode: boolean }
  | { ok: true; mode: "browser-serve"; host: string; port: number; token: string }
  | { ok: true; mode: "browser-run"; command: AgentCommand; bridgeUrl: string; token: string }
  | { ok: false; message: string };

const COMMANDS = new Set(["inspect", "preflight", "generate"]);

function readOption(rest: string[], name: string): string | undefined {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
}

function parseBrowserArgs(rest: string[]): ParsedArgs {
  const [subcommand, ...options] = rest;
  if (subcommand === "serve") {
    const portRaw = readOption(options, "--port") ?? "17321";
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port <= 0) {
      return { ok: false, message: `Invalid --port: ${portRaw}` };
    }
    return {
      ok: true,
      mode: "browser-serve",
      host: readOption(options, "--host") ?? "127.0.0.1",
      port,
      token: readOption(options, "--token") ?? "dev"
    };
  }

  if (subcommand === "run") {
    const [command, ...runOptions] = options;
    if (!COMMANDS.has(command)) {
      return { ok: false, message: `Unknown browser command: ${command ?? ""}`.trim() };
    }
    const bridgeUrl = readOption(runOptions, "--bridge");
    if (!bridgeUrl) {
      return { ok: false, message: "Missing --bridge" };
    }
    return {
      ok: true,
      mode: "browser-run",
      command: command as AgentCommand,
      bridgeUrl,
      token: readOption(runOptions, "--token") ?? "dev"
    };
  }

  return { ok: false, message: `Unknown browser subcommand: ${subcommand ?? ""}`.trim() };
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (command === "browser") {
    return parseBrowserArgs(rest);
  }

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

  return { ok: true, mode: "file", command: command as AgentCommand, inputPath, gcodeOut, includeGcode };
}
