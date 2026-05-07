import { runAgentCommand } from "../agentApi";
import { diagnostic, errorResponse } from "../responses";
import { parseCliArgs } from "./args";
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
