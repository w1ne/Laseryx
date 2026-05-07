import { describe, expect, it } from "vitest";
import { automationCapabilities, permissionForCapability } from "../capabilities";
import {
  DEFAULT_HOSTED_AGENT_PERMISSIONS,
  canUseCapabilityWithPermissions,
  emptyAgentSessionSnapshot,
  type AgentPermission,
  type AgentSessionSnapshot,
  type AgentSessionState
} from "./types";

function capability(command: string) {
  const found = automationCapabilities().find((item) => item.command === command);
  if (!found) throw new Error(`Missing test capability: ${command}`);
  return found;
}

describe("hosted agent session contract", () => {
  it("defines the hosted session states", () => {
    const states: AgentSessionState[] = ["off", "waiting", "review", "connected", "expired", "revoked", "error"];

    expect(states).toEqual([
      "off",
      "waiting",
      "review",
      "connected",
      "expired",
      "revoked",
      "error"
    ]);
  });

  it("defaults to read, edit, and generate without machine control", () => {
    expect(DEFAULT_HOSTED_AGENT_PERMISSIONS).toEqual(["read", "edit", "generate"]);
    expect(DEFAULT_HOSTED_AGENT_PERMISSIONS).not.toContain("project-storage");
    expect(DEFAULT_HOSTED_AGENT_PERMISSIONS).not.toContain("machine-control");
  });

  it("creates an empty off-session snapshot", () => {
    expect(emptyAgentSessionSnapshot()).toEqual({
      sessionId: null,
      state: "off",
      permissions: [],
      expiresAt: null,
      connectedAgentName: null,
      lastCommand: null
    } satisfies AgentSessionSnapshot);
  });

  it("maps capabilities to the permission required before browser execution", () => {
    expect(permissionForCapability(capability("automation.capabilities"))).toBe("read");
    expect(permissionForCapability(capability("project.summary"))).toBe("read");
    expect(permissionForCapability(capability("document.listObjects"))).toBe("read");
    expect(permissionForCapability(capability("document.addRect"))).toBe("edit");
    expect(permissionForCapability(capability("cam.setOperation"))).toBe("edit");
    expect(permissionForCapability(capability("ui.setActiveTab"))).toBe("edit");
    expect(permissionForCapability(capability("generate"))).toBe("generate");
    expect(permissionForCapability(capability("project.save"))).toBe("project-storage");
    expect(permissionForCapability(capability("project.importJson"))).toBe("project-storage");
  });

  it("checks capability use against granted permissions", () => {
    const defaultPermissions: AgentPermission[] = [...DEFAULT_HOSTED_AGENT_PERMISSIONS];

    expect(canUseCapabilityWithPermissions(capability("project.summary"), defaultPermissions)).toBe(true);
    expect(canUseCapabilityWithPermissions(capability("document.addRect"), defaultPermissions)).toBe(true);
    expect(canUseCapabilityWithPermissions(capability("generate"), defaultPermissions)).toBe(true);
    expect(canUseCapabilityWithPermissions(capability("project.save"), defaultPermissions)).toBe(false);
    expect(canUseCapabilityWithPermissions(capability("project.save"), [...defaultPermissions, "project-storage"])).toBe(true);
  });
});
