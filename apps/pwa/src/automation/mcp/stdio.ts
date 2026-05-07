import type { JsonRpcResponse } from "./server";

type RequestHandler = (request: unknown) => Promise<JsonRpcResponse | null>;
type LineWriter = (line: string) => void;

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function responseId(request: unknown): string | number | null {
  return typeof request === "object" &&
    request !== null &&
    !Array.isArray(request) &&
    "id" in request &&
    (typeof request.id === "string" || typeof request.id === "number" || request.id === null)
    ? request.id
    : null;
}

export function createMcpLineProcessor(handleRequest: RequestHandler, writeLine: LineWriter) {
  let queue = Promise.resolve();

  async function processLine(line: string): Promise<void> {
    if (line.trim() === "") {
      return;
    }

    const request = parseLine(line);
    try {
      const response = await handleRequest(request);
      if (response) {
        writeLine(JSON.stringify(response));
      }
    } catch (error) {
      writeLine(JSON.stringify({
        jsonrpc: "2.0",
        id: responseId(request),
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  }

  return {
    enqueue(line: string): void {
      queue = queue.then(() => processLine(line));
    },
    async drain(): Promise<void> {
      await queue;
    }
  };
}
