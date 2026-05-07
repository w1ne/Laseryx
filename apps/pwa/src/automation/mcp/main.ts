import { createInterface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import { handleMcpRequest } from "./server";

const bridgeUrl = process.env.LASERYX_BRIDGE_URL ?? "http://127.0.0.1:17321";
const token = process.env.LASERYX_BRIDGE_TOKEN ?? "dev";

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function handleLine(line: string): Promise<void> {
  if (line.trim() === "") {
    return;
  }

  const response = await handleMcpRequest(parseLine(line), { bridgeUrl, token });
  if (response) {
    stdout.write(`${JSON.stringify(response)}\n`);
  }
}

const input = createInterface({ input: stdin, crlfDelay: Infinity });

input.on("line", (line) => {
  handleLine(line).catch((error: unknown) => {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  });
});
