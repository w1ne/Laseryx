import { runAgentCommand } from "../agentApi";
import {
  BLOCKED_LINK_COMMANDS,
  encodeLinkCommandCapsule,
  readLinkCommandCapsuleFromHash,
  type LinkCommandCapsule
} from "../browser/linkCommands";
import { diagnostic, errorResponse } from "../responses";
import { parseCliArgs } from "./args";
import { fetchBridgeStatus, LocalBrowserBridgeServer, postBrowserCommand } from "./browserBridgeServer";
import { readJsonFile, writeTextFile } from "./fileIo";

export type CliResult = {
  exitCode: number;
  stdout: string;
};

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildAttachUrl(appUrl: string, bridgeUrl: string, token: string): string {
  const url = new URL(appUrl);
  url.searchParams.set("laseryxBridge", bridgeUrl);
  url.searchParams.set("laseryxToken", token);
  return url.toString();
}

function buildLinkCommandUrl(
  appUrl: string,
  capsule: LinkCommandCapsule
): string {
  const url = new URL(appUrl);
  url.hash = encodeLinkCommandCapsule(capsule).slice(1);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function linkValidationError(capsule: LinkCommandCapsule): string | null {
  const parsed = readLinkCommandCapsuleFromHash(encodeLinkCommandCapsule(capsule));
  return parsed.ok ? null : parsed.error;
}

function capsuleFromFile(value: unknown, titleOverride?: string): LinkCommandCapsule | string {
  if (!isRecord(value)) {
    return "Link command input must be an object";
  }
  if (!Array.isArray(value.commands)) {
    return "Link command input must include commands";
  }
  return {
    version: 1,
    ...(typeof titleOverride === "string" ? { title: titleOverride } : typeof value.title === "string" ? { title: value.title } : {}),
    commands: value.commands as LinkCommandCapsule["commands"]
  };
}

export async function runCli(argv: string[]): Promise<CliResult> {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    return {
      exitCode: 1,
      stdout: stringify(errorResponse("inspect", [
        diagnostic("CLI_ERROR", "error", parsed.message)
      ]))
    };
  }

  if (parsed.mode === "browser-serve") {
    const bridge = new LocalBrowserBridgeServer({ token: parsed.token });
    const server = bridge.createHttpServer();
    await new Promise<void>((resolve) => server.listen(parsed.port, parsed.host, resolve));
    return {
      exitCode: 0,
      stdout: `Laseryx browser bridge listening on http://${parsed.host}:${parsed.port}\nOpen the app with ?laseryxBridge=http://${parsed.host}:${parsed.port}&laseryxToken=${encodeURIComponent(parsed.token)}\n`
    };
  }

  if (parsed.mode === "browser-run") {
    try {
      const response = await postBrowserCommand(parsed.bridgeUrl, parsed.token, parsed.command, parsed.args);
      return {
        exitCode: response.ok ? 0 : 1,
        stdout: stringify(response)
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: stringify(errorResponse("inspect", [
          diagnostic("BRIDGE_COMMAND_FAILED", "error", error instanceof Error ? error.message : String(error))
        ]))
      };
    }
  }

  if (parsed.mode === "browser-status") {
    try {
      const status = await fetchBridgeStatus(parsed.bridgeUrl, parsed.token);
      return {
        exitCode: 0,
        stdout: stringify(status)
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: stringify(errorResponse("inspect", [
          diagnostic("BRIDGE_STATUS_FAILED", "error", error instanceof Error ? error.message : String(error))
        ]))
      };
    }
  }

  if (parsed.mode === "browser-attach-url") {
    return {
      exitCode: 0,
      stdout: `${buildAttachUrl(parsed.appUrl, parsed.bridgeUrl, parsed.token)}\n`
    };
  }

  if (parsed.mode === "browser-link") {
    const capsule: LinkCommandCapsule = {
      version: 1,
      ...(parsed.title ? { title: parsed.title } : {}),
      commands: [{
        command: parsed.command,
        args: parsed.args
      }]
    };
    const validationError = BLOCKED_LINK_COMMANDS.has(parsed.command)
      ? `Command not allowed in links: ${parsed.command}`
      : linkValidationError(capsule);
    if (validationError) {
      return {
        exitCode: 1,
        stdout: stringify(errorResponse("inspect", [
          diagnostic("LINK_COMMAND_INVALID", "error", validationError)
        ]))
      };
    }
    return {
      exitCode: 0,
      stdout: `${buildLinkCommandUrl(parsed.appUrl, capsule)}\n`
    };
  }

  if (parsed.mode === "browser-link-file") {
    let input: unknown;
    try {
      input = await readJsonFile(parsed.inputPath);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: stringify(errorResponse("inspect", [
          diagnostic("FILE_READ_FAILED", "error", error instanceof Error ? error.message : String(error))
        ]))
      };
    }
    const capsule = capsuleFromFile(input, parsed.title);
    const validationError = typeof capsule === "string" ? capsule : linkValidationError(capsule);
    if (validationError) {
      return {
        exitCode: 1,
        stdout: stringify(errorResponse("inspect", [
          diagnostic("LINK_COMMAND_INVALID", "error", validationError)
        ]))
      };
    }
    return {
      exitCode: 0,
      stdout: `${buildLinkCommandUrl(parsed.appUrl, capsule)}\n`
    };
  }

  let input: unknown;
  try {
    input = await readJsonFile(parsed.inputPath);
  } catch (error) {
    return {
      exitCode: 1,
      stdout: stringify(errorResponse(parsed.command, [
        diagnostic("FILE_READ_FAILED", "error", error instanceof Error ? error.message : String(error))
      ]))
    };
  }

  let response = runAgentCommand(parsed.command, input, {
    gcodePath: parsed.gcodeOut,
    includeGcode: parsed.command === "generate" && !parsed.gcodeOut ? true : parsed.includeGcode || !!parsed.gcodeOut
  });

  if (response.ok && parsed.command === "generate" && parsed.gcodeOut && response.data && "gcode" in response.data) {
    const gcode = response.data.gcode;
    if (typeof gcode === "string") {
      await writeTextFile(parsed.gcodeOut, gcode);
    }
    if (!parsed.includeGcode) {
      response = runAgentCommand(parsed.command, input, {
        gcodePath: parsed.gcodeOut,
        includeGcode: false
      });
    }
  }

  return {
    exitCode: response.ok ? 0 : 1,
    stdout: stringify(response)
  };
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("laseryx.mjs")) {
  runCli(process.argv.slice(2)).then((result) => {
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
  });
}
