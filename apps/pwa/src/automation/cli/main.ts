import { runAgentCommand } from "../agentApi";
import { diagnostic, errorResponse } from "../responses";
import { parseCliArgs } from "./args";
import { LocalBrowserBridgeServer, postBrowserCommand } from "./browserBridgeServer";
import { readJsonFile, writeTextFile } from "./fileIo";

export type CliResult = {
  exitCode: number;
  stdout: string;
};

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
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
    includeGcode: parsed.includeGcode || !!parsed.gcodeOut
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
