import { createInterface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import { handleMcpRequest } from "./server";
import { createMcpLineProcessor } from "./stdio";

const bridgeUrl = process.env.LASERYX_BRIDGE_URL ?? "http://127.0.0.1:17321";
const token = process.env.LASERYX_BRIDGE_TOKEN ?? "dev";

const processor = createMcpLineProcessor(
  (request) => handleMcpRequest(request, { bridgeUrl, token }),
  (line) => stdout.write(`${line}\n`)
);

const input = createInterface({ input: stdin, crlfDelay: Infinity });

input.on("line", (line) => {
  try {
    processor.enqueue(line);
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
});
