import { automationCapabilities } from "../capabilities";
import { AUTOMATION_PROTOCOL_VERSION, type AutomationProtocolCommand, type AutomationProtocolRequest, type AutomationProtocolResponse } from "../protocol/types";
import {
  DEFAULT_HOSTED_AGENT_PERMISSIONS,
  emptyAgentSessionSnapshot,
  type AgentPermission,
  type AgentSessionSnapshot
} from "./types";

export class HostedAgentSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = "HostedAgentSessionError";
  }
}

export type HostedAgentSessionCreated = {
  sessionId: string;
  pairingCode: string;
  channelToken: string;
  expiresAt: string;
  snapshot: AgentSessionSnapshot;
};

export type HostedAgentSessionClaim = {
  agentToken: string;
  snapshot: AgentSessionSnapshot;
};

export type HostedAgentBrowserStatus = AgentSessionSnapshot & {
  browserAttached: boolean;
};

export type HostedAgentQueuedCommand = {
  request: AutomationProtocolRequest;
};

export type HostedAgentSessionBrokerOptions = {
  now?: () => Date;
  createId?: () => string;
  ttlMs?: number;
};

export type CreateHostedAgentSessionOptions = {
  permissions?: AgentPermission[];
};

type HostedSessionRecord = {
  sessionId: string;
  pairingCode: string;
  channelToken: string;
  agentToken: string | null;
  browserAttached: boolean;
  expiresAtMs: number;
  snapshot: AgentSessionSnapshot;
  queue: AutomationProtocolRequest[];
  inFlight: Map<string, AutomationProtocolRequest>;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function defaultCreateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function cloneSnapshot(snapshot: AgentSessionSnapshot): AgentSessionSnapshot {
  return {
    ...snapshot,
    permissions: [...snapshot.permissions],
    lastCommand: snapshot.lastCommand ? { ...snapshot.lastCommand } : null
  };
}

function cloneBrowserStatus(record: HostedSessionRecord): HostedAgentBrowserStatus {
  return {
    ...cloneSnapshot(record.snapshot),
    browserAttached: record.browserAttached
  };
}

function permissionForCommand(command: AutomationProtocolCommand): AgentPermission {
  const capability = automationCapabilities().find((item) => item.command === command);
  if (!capability) {
    throw new HostedAgentSessionError("SESSION_UNKNOWN_COMMAND", `No hosted capability for ${command}`);
  }
  return capability.requiredPermission;
}

export function createHostedAgentSessionBroker(options: HostedAgentSessionBrokerOptions = {}) {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const sessions = new Map<string, HostedSessionRecord>();

  const requireRecord = (sessionId: string): HostedSessionRecord => {
    const record = sessions.get(sessionId);
    if (!record) {
      throw new HostedAgentSessionError("SESSION_NOT_FOUND", `No hosted session ${sessionId}`);
    }
    refreshExpiry(record);
    return record;
  };

  const requireLiveRecord = (sessionId: string): HostedSessionRecord => {
    const record = requireRecord(sessionId);
    if (record.snapshot.state === "expired") {
      throw new HostedAgentSessionError("SESSION_EXPIRED", "Hosted session expired");
    }
    if (record.snapshot.state === "revoked") {
      throw new HostedAgentSessionError("SESSION_REVOKED", "Hosted session was revoked");
    }
    return record;
  };

  const requireAgent = (record: HostedSessionRecord, agentToken: string): void => {
    if (!record.agentToken || record.agentToken !== agentToken) {
      throw new HostedAgentSessionError("SESSION_AGENT_UNAUTHORIZED", "Agent token is not valid for this session");
    }
  };

  const requireBrowser = (record: HostedSessionRecord, channelToken: string): void => {
    if (record.channelToken !== channelToken) {
      throw new HostedAgentSessionError("SESSION_BROWSER_UNAUTHORIZED", "Browser channel token is not valid for this session");
    }
  };

  function refreshExpiry(record: HostedSessionRecord): void {
    if (record.snapshot.state !== "revoked" && now().getTime() > record.expiresAtMs) {
      record.snapshot = { ...record.snapshot, state: "expired" };
    }
  }

  return {
    createSession(createOptions: CreateHostedAgentSessionOptions = {}): HostedAgentSessionCreated {
      const seed = createId();
      const sessionId = `session-${seed}`;
      const pairingCode = `pair-${createId()}`;
      const channelToken = `channel-${createId()}`;
      const expiresAtMs = now().getTime() + ttlMs;
      const permissions = createOptions.permissions ?? DEFAULT_HOSTED_AGENT_PERMISSIONS;
      const snapshot: AgentSessionSnapshot = {
        ...emptyAgentSessionSnapshot(),
        sessionId,
        state: "waiting",
        permissions: [...permissions],
        expiresAt: new Date(expiresAtMs).toISOString()
      };
      const record: HostedSessionRecord = {
        sessionId,
        pairingCode,
        channelToken,
        agentToken: null,
        browserAttached: false,
        expiresAtMs,
        snapshot,
        queue: [],
        inFlight: new Map()
      };
      sessions.set(sessionId, record);
      return { sessionId, pairingCode, channelToken, expiresAt: snapshot.expiresAt ?? "", snapshot: cloneSnapshot(snapshot) };
    },

    getSessionStatus(sessionId: string): HostedAgentBrowserStatus {
      return cloneBrowserStatus(requireRecord(sessionId));
    },

    attachBrowser(input: { sessionId: string; channelToken: string }): HostedAgentBrowserStatus {
      const record = requireLiveRecord(input.sessionId);
      requireBrowser(record, input.channelToken);
      record.browserAttached = true;
      if (record.agentToken) {
        record.snapshot = { ...record.snapshot, state: "connected" };
      }
      return cloneBrowserStatus(record);
    },

    detachBrowser(input: { sessionId: string; channelToken: string }): HostedAgentBrowserStatus {
      const record = requireLiveRecord(input.sessionId);
      requireBrowser(record, input.channelToken);
      record.browserAttached = false;
      record.snapshot = { ...record.snapshot, state: "error" };
      return cloneBrowserStatus(record);
    },

    claimSession(input: { sessionId: string; pairingCode: string; agentName: string }): HostedAgentSessionClaim {
      const record = requireLiveRecord(input.sessionId);
      if (record.pairingCode !== input.pairingCode) {
        throw new HostedAgentSessionError("SESSION_PAIRING_DENIED", "Pairing code is not valid for this session");
      }
      record.agentToken = `agent-${createId()}`;
      record.snapshot = {
        ...record.snapshot,
        state: record.browserAttached ? "connected" : "waiting",
        connectedAgentName: input.agentName
      };
      return { agentToken: record.agentToken, snapshot: cloneSnapshot(record.snapshot) };
    },

    enqueueCommand(input: {
      sessionId: string;
      agentToken: string;
      command: AutomationProtocolCommand;
      args?: Record<string, unknown>;
    }): HostedAgentQueuedCommand {
      const record = requireLiveRecord(input.sessionId);
      requireAgent(record, input.agentToken);
      if (!record.browserAttached) {
        throw new HostedAgentSessionError("SESSION_BROWSER_DISCONNECTED", "Browser is not attached to this session");
      }
      const requiredPermission = permissionForCommand(input.command);
      if (!record.snapshot.permissions.includes(requiredPermission)) {
        throw new HostedAgentSessionError("SESSION_PERMISSION_DENIED", `${input.command} requires ${requiredPermission}`);
      }
      const request: AutomationProtocolRequest = {
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: `request-${createId()}`,
        command: input.command,
        args: input.args ?? {}
      };
      record.queue.push(request);
      record.snapshot = {
        ...record.snapshot,
        lastCommand: {
          requestId: request.requestId,
          command: request.command,
          ok: null,
          startedAt: now().toISOString(),
          completedAt: null
        }
      };
      return { request };
    },

    nextBrowserCommand(input: { sessionId: string; channelToken: string }): AutomationProtocolRequest | null {
      const record = requireLiveRecord(input.sessionId);
      requireBrowser(record, input.channelToken);
      const request = record.queue.shift() ?? null;
      if (request) {
        record.inFlight.set(request.requestId, request);
      }
      return request;
    },

    acceptResponse(input: {
      sessionId: string;
      channelToken: string;
      response: AutomationProtocolResponse;
    }): AgentSessionSnapshot {
      const record = requireLiveRecord(input.sessionId);
      requireBrowser(record, input.channelToken);
      const request = record.inFlight.get(input.response.requestId);
      if (!request) {
        throw new HostedAgentSessionError("SESSION_UNKNOWN_RESPONSE", "Response did not match an in-flight command");
      }
      record.inFlight.delete(input.response.requestId);
      record.snapshot = {
        ...record.snapshot,
        lastCommand: {
          requestId: input.response.requestId,
          command: input.response.command,
          ok: input.response.ok,
          startedAt: record.snapshot.lastCommand?.requestId === input.response.requestId
            ? record.snapshot.lastCommand.startedAt
            : now().toISOString(),
          completedAt: now().toISOString()
        }
      };
      return cloneSnapshot(record.snapshot);
    },

    revokeSession(input: { sessionId: string }): AgentSessionSnapshot {
      const record = requireRecord(input.sessionId);
      record.queue = [];
      record.inFlight.clear();
      record.snapshot = { ...record.snapshot, state: "revoked", connectedAgentName: null };
      return cloneSnapshot(record.snapshot);
    }
  };
}
