import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolCommand, type AutomationProtocolRequest, type AutomationProtocolResponse } from "../protocol/types";

type PendingCommand = {
  request: AutomationProtocolRequest;
  resolve: (response: AutomationProtocolResponse) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

export type BrowserBridgeLifecycleState = "detached" | "waiting" | "busy" | "idle";

export type BrowserBridgeStatus = {
  ok: true;
  attached: boolean;
  state: BrowserBridgeLifecycleState;
  pendingCount: number;
  inFlightCount: number;
  waiterCount: number;
  uptimeMs: number;
  lastBrowserPollAt: number | null;
  lastBrowserResponseAt: number | null;
};

class BridgeHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type LocalBrowserBridgeServerOptions = {
  token: string;
  commandTimeoutMs?: number;
  pollTimeoutMs?: number;
  browserStaleMs?: number;
  now?: () => number;
};

function assertToken(actual: string | null, expected: string): void {
  if (actual !== expected) {
    throw new BridgeHttpError(401, "Invalid bridge token");
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
  private readonly browserStaleMs: number;
  private readonly now: () => number;
  private readonly startedAt: number;
  private queue: PendingCommand[] = [];
  private inFlight = new Map<string, PendingCommand>();
  private waiters: Array<(command: PendingCommand | null) => void> = [];
  private lastBrowserPollAt: number | null = null;
  private lastBrowserResponseAt: number | null = null;

  constructor(options: LocalBrowserBridgeServerOptions) {
    this.token = options.token;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 25_000;
    this.browserStaleMs = options.browserStaleMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
  }

  private startTimeout(pending: PendingCommand): void {
    if (pending.timeout) return;
    pending.timeout = setTimeout(() => {
      this.inFlight.delete(pending.request.requestId);
      this.queue = this.queue.filter((item) => item !== pending);
      pending.reject(new BridgeHttpError(504, `Timed out waiting for browser response: ${pending.request.command}`));
      this.armQueuedTimeouts();
    }, this.commandTimeoutMs);
  }

  private clearTimeout(pending: PendingCommand): void {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
      pending.timeout = undefined;
    }
  }

  private armQueuedTimeouts(): void {
    if (this.inFlight.size > 0) return;
    for (const pending of this.queue) {
      this.startTimeout(pending);
    }
  }

  private disarmQueuedTimeouts(): void {
    for (const pending of this.queue) {
      this.clearTimeout(pending);
    }
  }

  private markInFlight(pending: PendingCommand): void {
    this.clearTimeout(pending);
    this.inFlight.set(pending.request.requestId, pending);
    this.startTimeout(pending);
    this.disarmQueuedTimeouts();
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
        this.armQueuedTimeouts();
      }
    });
  }

  async takeNextCommand(token: string): Promise<AutomationProtocolRequest | null> {
    assertToken(token, this.token);
    this.lastBrowserPollAt = this.now();
    const existing = this.queue.shift();
    if (existing) {
      this.markInFlight(existing);
      return existing.request;
    }

    return new Promise((resolve) => {
      const waiter = (pending: PendingCommand | null) => {
        clearTimeout(timer);
        this.lastBrowserPollAt = this.now();
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
    this.lastBrowserResponseAt = this.now();
    const pending = this.inFlight.get(response.requestId);
    if (pending) {
      this.clearTimeout(pending);
      pending.resolve(response);
      this.inFlight.delete(response.requestId);
      this.armQueuedTimeouts();
    }
  }

  getStatus(): BrowserBridgeStatus {
    const now = this.now();
    const attached = this.lastBrowserPollAt !== null && now - this.lastBrowserPollAt <= this.browserStaleMs;
    const pendingCount = this.queue.length;
    const inFlightCount = this.inFlight.size;
    const state: BrowserBridgeLifecycleState = inFlightCount > 0
      ? "busy"
      : pendingCount > 0
        ? "waiting"
        : attached
          ? "idle"
          : "detached";
    return {
      ok: true,
      attached,
      state,
      pendingCount,
      inFlightCount,
      waiterCount: this.waiters.length,
      uptimeMs: Math.max(0, now - this.startedAt),
      lastBrowserPollAt: this.lastBrowserPollAt,
      lastBrowserResponseAt: this.lastBrowserResponseAt
    };
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

        if (request.method === "GET" && url.pathname === "/status") {
          writeJson(response, 200, this.getStatus());
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
        const status = error instanceof BridgeHttpError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 500;
        writeJson(response, status, {
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
    const text = await response.text();
    let message = "";
    try {
      const body = JSON.parse(text) as { error?: unknown };
      message = typeof body.error === "string" ? body.error : "";
    } catch {
      message = text.trim();
    }
    throw new Error(`Bridge command failed: ${response.status}${message ? ` ${message}` : ""}`);
  }
  return await response.json() as AutomationProtocolResponse;
}

export async function fetchBridgeStatus(
  bridgeUrl: string,
  token: string
): Promise<BrowserBridgeStatus> {
  const url = new URL("/status", bridgeUrl);
  url.searchParams.set("token", token);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    let message = "";
    try {
      const body = JSON.parse(text) as { error?: unknown };
      message = typeof body.error === "string" ? body.error : "";
    } catch {
      message = text.trim();
    }
    throw new Error(`Bridge status failed: ${response.status}${message ? ` ${message}` : ""}`);
  }
  return await response.json() as BrowserBridgeStatus;
}
