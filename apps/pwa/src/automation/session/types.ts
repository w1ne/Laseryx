import type { AutomationCapability } from "../capabilities";

export type AgentSessionState = "off" | "waiting" | "review" | "connected" | "expired" | "revoked" | "error";

export type AgentPermission = "read" | "edit" | "generate" | "project-storage" | "machine-control";

export type AgentSessionLastCommand = {
  requestId: string;
  command: string;
  ok: boolean | null;
  startedAt: string;
  completedAt: string | null;
};

export type AgentSessionSnapshot = {
  sessionId: string | null;
  state: AgentSessionState;
  permissions: AgentPermission[];
  expiresAt: string | null;
  connectedAgentName: string | null;
  lastCommand: AgentSessionLastCommand | null;
};

export const DEFAULT_HOSTED_AGENT_PERMISSIONS: AgentPermission[] = ["read", "edit", "generate"];

export function emptyAgentSessionSnapshot(): AgentSessionSnapshot {
  return {
    sessionId: null,
    state: "off",
    permissions: [],
    expiresAt: null,
    connectedAgentName: null,
    lastCommand: null
  };
}

export function canUseCapabilityWithPermissions(
  capability: AutomationCapability,
  permissions: readonly AgentPermission[]
): boolean {
  return permissions.includes(capability.requiredPermission);
}
