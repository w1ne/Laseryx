import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolCommand, type AutomationProtocolRequest, type AutomationProtocolResponse } from "../protocol/types";

type PendingCommand = {
  request: AutomationProtocolRequest;
  resolve: (response: AutomationProtocolResponse) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

export type LocalBrowserBridgeServerOptions = {
  token: string;
  commandTimeoutMs?: number;
  pollTimeoutMs?: number;
};

function assertToken(actual: string | null, expected: string): void {
  if (actual !== expected) {
    throw new Error("Invalid bridge token");
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length > 0 ? JSON.parse(text) : {};
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(value));
}

export class LocalBrowserBridgeServer {
  private readonly token: string;
  private readonly commandTimeoutMs: number;
  private readonly pollTimeoutMs: number;
  private queue: PendingCommand[] = [];
  private inFlight = new Map<string, PendingCommand>();
  private waiters: Array<(command: PendingCommand | null) => void> = [];

  constructor(options: LocalBrowserBridgeServerOptions) {
    this.token = options.token;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 25_000;
  }

  private markInFlight(pending: PendingCommand): void {
    this.inFlight.set(pending.request.requestId, pending);
    pending.timeout = setTimeout(() => {
      if (this.inFlight.delete(pending.request.requestId)) {
        pending.reject(new Error(`Timed out waiting for browser response: ${pending.request.command}`));
      }
    }, this.commandTimeoutMs);
  }

  enqueueCommand(command: AutomationProtocolCommand, args: Record<string, unknown> = {}): Promise<AutomationProtocolResponse> {
    const request: AutomationProtocolRequest = {
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: randomUUID(),
      command,
      args
    };

    return new Promise((resolve, reject) => {
      const pending: PendingCommand = { request, resolve, reject };
      const waiter = this.waiters.shift();
      if (waiter) {
        this.markInFlight(pending);
        waiter(pending);
      } else {
        this.queue.push(pending);
      }
    });
  }

  async takeNextCommand(token: string): Promise<AutomationProtocolRequest | null> {
    assertToken(token, this.token);
    const existing = this.queue.shift();
    if (existing) {
      this.markInFlight(existing);
      return existing.request;
    }

    return new Promise((resolve) => {
      const waiter = (pending: PendingCommand | null) => {
        clearTimeout(timer);
        resolve(pending?.request ?? null);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        resolve(null);
      }, this.pollTimeoutMs);
      this.waiters.push(waiter);
    });
  }

  acceptResponse(token: string, response: AutomationProtocolResponse): void {
    assertToken(token, this.token);
    const pending = this.inFlight.get(response.requestId);
    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.resolve(response);
      this.inFlight.delete(response.requestId);
    }
  }

  createHttpServer(): Server {
    return createServer(async (request, response) => {
      try {
        response.setHeader("access-control-allow-origin", "*");
        response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
        response.setHeader("access-control-allow-headers", "content-type");
        if (request.method === "OPTIONS") {
          response.writeHead(204);
          response.end();
          return;
        }

        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const token = url.searchParams.get("token");
        assertToken(token, this.token);

        if (request.method === "GET" && url.pathname === "/health") {
          writeJson(response, 200, { ok: true });
          return;
        }

        if (request.method === "GET" && url.pathname === "/next") {
          const next = await this.takeNextCommand(token ?? "");
          if (!next) {
            response.writeHead(204);
            response.end();
            return;
          }
          writeJson(response, 200, next);
          return;
        }

        if (request.method === "POST" && url.pathname === "/response") {
          const body = await readJsonBody(request);
          this.acceptResponse(token ?? "", body as AutomationProtocolResponse);
          writeJson(response, 200, { ok: true });
          return;
        }

        if (request.method === "POST" && url.pathname === "/command") {
          const body = await readJsonBody(request) as { command?: AutomationProtocolCommand; args?: Record<string, unknown> };
          if (!body.command) {
            writeJson(response, 400, { ok: false, error: "Missing command" });
            return;
          }
          const result = await this.enqueueCommand(body.command, body.args ?? {});
          writeJson(response, 200, result);
          return;
        }

        writeJson(response, 404, { ok: false, error: "Not found" });
      } catch (error) {
        writeJson(response, 401, {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
}

export async function postBrowserCommand(
  bridgeUrl: string,
  token: string,
  command: AutomationProtocolCommand,
  args: Record<string, unknown> = {}
): Promise<AutomationProtocolResponse> {
  const url = new URL("/command", bridgeUrl);
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, args })
  });
  if (!response.ok) {
    throw new Error(`Bridge command failed: ${response.status}`);
  }
  return await response.json() as AutomationProtocolResponse;
}
