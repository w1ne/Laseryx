import type { AutomationProtocolCommand } from "../protocol/types";
import type { AgentCommand } from "../types";
import { cliAutomationCapabilities } from "../capabilities";

type ParsedArgs =
  | { ok: true; mode: "file"; command: AgentCommand; inputPath: string; gcodeOut?: string; includeGcode: boolean }
  | { ok: true; mode: "browser-serve"; host: string; port: number; token: string }
  | { ok: true; mode: "browser-run"; command: AutomationProtocolCommand; bridgeUrl: string; token: string; args: Record<string, unknown> }
  | { ok: true; mode: "browser-status"; bridgeUrl: string; token: string }
  | { ok: true; mode: "browser-attach-url"; appUrl: string; bridgeUrl: string; token: string }
  | { ok: true; mode: "browser-link"; appUrl: string; title?: string; command: AutomationProtocolCommand; args: Record<string, unknown> }
  | { ok: true; mode: "browser-link-file"; appUrl: string; title?: string; inputPath: string }
  | { ok: false; message: string };

const COMMANDS = new Set(["inspect", "preflight", "generate"]);
const BROWSER_COMMANDS = new Set(cliAutomationCapabilities().map((capability) => capability.command));

function readOption(rest: string[], name: string): string | undefined {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
}

function parseValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return value.trim() !== "" && Number.isFinite(numeric) ? numeric : value;
}

function parseCommandArgs(rest: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = parseValue(next);
      index += 1;
    }
  }
  return args;
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
    if (!BROWSER_COMMANDS.has(command)) {
      return { ok: false, message: `Unknown browser command: ${command ?? ""}`.trim() };
    }
    const bridgeUrl = readOption(runOptions, "--bridge");
    if (!bridgeUrl) {
      return { ok: false, message: "Missing --bridge" };
    }
    return {
      ok: true,
      mode: "browser-run",
      command: command as AutomationProtocolCommand,
      bridgeUrl,
      token: readOption(runOptions, "--token") ?? "dev",
      args: parseCommandArgs(runOptions.filter((item, index) => {
        const previous = runOptions[index - 1];
        return item !== "--bridge" && item !== "--token" && previous !== "--bridge" && previous !== "--token";
      }))
    };
  }

  if (subcommand === "status") {
    const bridgeUrl = readOption(options, "--bridge");
    if (!bridgeUrl) {
      return { ok: false, message: "Missing --bridge" };
    }
    return {
      ok: true,
      mode: "browser-status",
      bridgeUrl,
      token: readOption(options, "--token") ?? "dev"
    };
  }

  if (subcommand === "attach-url") {
    const bridgeUrl = readOption(options, "--bridge");
    if (!bridgeUrl) {
      return { ok: false, message: "Missing --bridge" };
    }
    return {
      ok: true,
      mode: "browser-attach-url",
      appUrl: readOption(options, "--app") ?? "http://localhost:5173",
      bridgeUrl,
      token: readOption(options, "--token") ?? "dev"
    };
  }

  if (subcommand === "link") {
    const inputPath = readOption(options, "--input");
    if (inputPath) {
      return {
        ok: true,
        mode: "browser-link-file",
        appUrl: readOption(options, "--app") ?? "https://laseryx.com/",
        title: readOption(options, "--title"),
        inputPath
      };
    }
    const [command, ...linkOptions] = options;
    if (!BROWSER_COMMANDS.has(command)) {
      return { ok: false, message: `Unknown browser command: ${command ?? ""}`.trim() };
    }
    return {
      ok: true,
      mode: "browser-link",
      appUrl: readOption(linkOptions, "--app") ?? "https://laseryx.com/",
      title: readOption(linkOptions, "--title"),
      command: command as AutomationProtocolCommand,
      args: parseCommandArgs(linkOptions.filter((item, index) => {
        const previous = linkOptions[index - 1];
        return item !== "--app" && item !== "--title" && previous !== "--app" && previous !== "--title";
      }))
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
