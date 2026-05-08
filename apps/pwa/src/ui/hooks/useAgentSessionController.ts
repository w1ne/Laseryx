import { useMemo, useState } from "react";
import {
  DEFAULT_HOSTED_AGENT_PERMISSIONS,
  emptyAgentSessionSnapshot,
  type AgentSessionSnapshot
} from "../../automation/session/types";

type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

export type AgentSessionCopyState = "idle" | "copied" | "failed";

export type AgentSessionControllerOptions = {
  origin?: string;
  clipboard?: ClipboardWriter;
  createSessionId?: () => string;
};

function getBrowserOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

function getBrowserClipboard(): ClipboardWriter | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return navigator.clipboard;
}

function createLocalSessionId(): string {
  return `local-${Date.now().toString(36)}`;
}

function createConnectionLink(origin: string, sessionId: string | null): string {
  if (!origin || !sessionId) {
    return "";
  }

  return `${origin}/agent/session#${encodeURIComponent(sessionId)}`;
}

export function useAgentSessionController(options: AgentSessionControllerOptions = {}) {
  const [session, setSession] = useState<AgentSessionSnapshot>(() => emptyAgentSessionSnapshot());
  const [copyState, setCopyState] = useState<AgentSessionCopyState>("idle");
  const origin = options.origin ?? getBrowserOrigin();
  const createSessionId = options.createSessionId ?? createLocalSessionId;
  const clipboard = options.clipboard ?? getBrowserClipboard();
  const connectionLink = useMemo(() => createConnectionLink(origin, session.sessionId), [origin, session.sessionId]);

  const enableAgentControl = () => {
    setCopyState("idle");
    setSession({
      sessionId: createSessionId(),
      state: "waiting",
      permissions: [...DEFAULT_HOSTED_AGENT_PERMISSIONS],
      expiresAt: null,
      connectedAgentName: null,
      lastCommand: null
    });
  };

  const disconnectAgentControl = () => {
    setSession((current) => ({
      ...current,
      state: "revoked",
      connectedAgentName: null
    }));
  };

  const copyConnectionLink = async () => {
    if (!connectionLink || !clipboard) {
      setCopyState("failed");
      return;
    }

    try {
      await clipboard.writeText(connectionLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return {
    session,
    connectionLink,
    copyState,
    enableAgentControl,
    disconnectAgentControl,
    copyConnectionLink
  };
}
