import type { InAppAutomationBridge } from "../browser/inAppBridge";
import type { AutomationProtocolRequest, AutomationProtocolResponse } from "../protocol/types";
import { DEFAULT_HOSTED_AGENT_PERMISSIONS, emptyAgentSessionSnapshot, type AgentPermission, type AgentSessionSnapshot } from "./types";

export type HostedAgentSessionCreated = {
  sessionId: string;
  pairingCode: string;
  channelToken: string;
  expiresAt: string;
};

export type BrowserAgentSessionChannel = {
  close: () => void;
};

export type BrowserAgentSessionChannelHandlers = {
  onRequest: (request: AutomationProtocolRequest) => Promise<void>;
  onStatus: (snapshot: Partial<AgentSessionSnapshot>) => void;
};

export type BrowserAgentSessionTransport = {
  createSession: (permissions: AgentPermission[]) => Promise<HostedAgentSessionCreated>;
  connectChannel: (
    session: HostedAgentSessionCreated,
    handlers: BrowserAgentSessionChannelHandlers
  ) => Promise<BrowserAgentSessionChannel>;
  sendProtocolResponse: (
    session: HostedAgentSessionCreated,
    response: AutomationProtocolResponse
  ) => Promise<void>;
  disconnect: (session: HostedAgentSessionCreated) => Promise<void>;
};

export type BrowserAgentSessionClientOptions = {
  transport: BrowserAgentSessionTransport;
  bridge: InAppAutomationBridge;
  now?: () => Date;
  defaultPermissions?: AgentPermission[];
};

export type BrowserAgentSessionClient = {
  createSession: () => Promise<AgentSessionSnapshot>;
  connectChannel: () => Promise<BrowserAgentSessionChannel>;
  sendProtocolResponse: (response: AutomationProtocolResponse) => Promise<void>;
  disconnect: () => Promise<AgentSessionSnapshot>;
  subscribeStatus: (listener: (snapshot: AgentSessionSnapshot) => void) => () => void;
  getSnapshot: () => AgentSessionSnapshot;
};

function cloneSnapshot(snapshot: AgentSessionSnapshot): AgentSessionSnapshot {
  return {
    ...snapshot,
    permissions: [...snapshot.permissions],
    lastCommand: snapshot.lastCommand ? { ...snapshot.lastCommand } : null
  };
}

function protocolErrorResponse(request: AutomationProtocolRequest, error: unknown): AutomationProtocolResponse {
  return {
    protocolVersion: request.protocolVersion,
    requestId: request.requestId,
    ok: false,
    command: request.command,
    data: null,
    warnings: [],
    errors: [{
      code: "SESSION_BRIDGE_REQUEST_FAILED",
      severity: "error",
      message: error instanceof Error ? error.message : String(error)
    }]
  } as AutomationProtocolResponse;
}

export function createBrowserAgentSessionClient(options: BrowserAgentSessionClientOptions): BrowserAgentSessionClient {
  const listeners = new Set<(snapshot: AgentSessionSnapshot) => void>();
  const now = options.now ?? (() => new Date());
  const defaultPermissions = options.defaultPermissions ?? DEFAULT_HOSTED_AGENT_PERMISSIONS;
  let session: HostedAgentSessionCreated | null = null;
  let channel: BrowserAgentSessionChannel | null = null;
  let snapshot = emptyAgentSessionSnapshot();

  const notify = () => {
    const current = cloneSnapshot(snapshot);
    for (const listener of listeners) {
      listener(current);
    }
  };

  const updateSnapshot = (patch: Partial<AgentSessionSnapshot>) => {
    snapshot = {
      ...snapshot,
      ...patch,
      permissions: patch.permissions ? [...patch.permissions] : snapshot.permissions
    };
    notify();
  };

  const requireSession = (): HostedAgentSessionCreated => {
    if (!session) {
      throw new Error("No active agent session");
    }
    return session;
  };

  const handleRequest = async (request: AutomationProtocolRequest): Promise<void> => {
    const activeSession = requireSession();
    const startedAt = now().toISOString();
    updateSnapshot({
      lastCommand: {
        requestId: request.requestId,
        command: request.command,
        ok: null,
        startedAt,
        completedAt: null
      }
    });

    let response: AutomationProtocolResponse;
    try {
      response = await options.bridge.request(request);
    } catch (error) {
      response = protocolErrorResponse(request, error);
    }

    await options.transport.sendProtocolResponse(activeSession, response);
    updateSnapshot({
      lastCommand: {
        requestId: request.requestId,
        command: request.command,
        ok: response.ok,
        startedAt,
        completedAt: now().toISOString()
      }
    });
  };

  return {
    async createSession() {
      session = await options.transport.createSession([...defaultPermissions]);
      updateSnapshot({
        sessionId: session.sessionId,
        state: "waiting",
        permissions: [...defaultPermissions],
        expiresAt: session.expiresAt,
        connectedAgentName: null,
        lastCommand: null
      });
      return cloneSnapshot(snapshot);
    },

    async connectChannel() {
      const activeSession = requireSession();
      channel = await options.transport.connectChannel(activeSession, {
        onRequest: handleRequest,
        onStatus: (patch) => updateSnapshot(patch)
      });
      return channel;
    },

    async sendProtocolResponse(response) {
      await options.transport.sendProtocolResponse(requireSession(), response);
    },

    async disconnect() {
      const activeSession = requireSession();
      channel?.close();
      channel = null;
      await options.transport.disconnect(activeSession);
      updateSnapshot({ state: "revoked" });
      return cloneSnapshot(snapshot);
    },

    subscribeStatus(listener) {
      listeners.add(listener);
      listener(cloneSnapshot(snapshot));
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return cloneSnapshot(snapshot);
    }
  };
}
