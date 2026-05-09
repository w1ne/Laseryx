import { describe, expect, it } from "vitest";
import { AUTOMATION_CAPABILITIES, getAutomationCommandNames, mutableAutomationCapabilities } from "./capabilities";
import { validateProtocolRequest } from "./protocol/validate";
import { AUTOMATION_PROTOCOL_VERSION } from "./protocol/types";

describe("automation capabilities", () => {
  it("exposes a deterministic canonical command manifest", () => {
    expect(getAutomationCommandNames()).toEqual([
      "inspect",
      "preflight",
      "generate",
      "automation.capabilities",
      "cam.setOperation",
      "ui.setActiveTab",
      "ui.setPreviewMode",
      "ui.selectDesignPanel",
      "document.listObjects",
      "document.selectObject",
      "document.addRect",
      "document.updateObjectTransform",
      "document.setObjectLayer",
      "document.deleteObject",
      "project.new",
      "project.save",
      "project.list",
      "project.open",
      "project.delete",
      "project.summary",
      "project.exportJson",
      "project.importJson",
      "layer.list",
      "layer.create",
      "layer.rename",
      "layer.delete",
      "layer.setVisibility",
      "layer.setLock",
      "layer.get",
      "material.list",
      "material.applyToLayer"
    ]);
  });

  it("uses the capability manifest as the protocol command boundary", () => {
    for (const command of getAutomationCommandNames()) {
      expect(validateProtocolRequest({
        protocolVersion: AUTOMATION_PROTOCOL_VERSION,
        requestId: `req-${command}`,
        command,
        args: {}
      }).ok).toBe(true);
    }
  });

  it("declares dry-run support explicitly for every mutable command", () => {
    expect(mutableAutomationCapabilities().map((capability) => ({
      command: capability.command,
      supportsDryRun: capability.supportsDryRun
    }))).toEqual([
      { command: "generate", supportsDryRun: false },
      { command: "cam.setOperation", supportsDryRun: true },
      { command: "ui.setActiveTab", supportsDryRun: false },
      { command: "ui.setPreviewMode", supportsDryRun: false },
      { command: "ui.selectDesignPanel", supportsDryRun: false },
      { command: "document.selectObject", supportsDryRun: false },
      { command: "document.addRect", supportsDryRun: false },
      { command: "document.updateObjectTransform", supportsDryRun: true },
      { command: "document.setObjectLayer", supportsDryRun: false },
      { command: "document.deleteObject", supportsDryRun: true },
      { command: "project.new", supportsDryRun: false },
      { command: "project.save", supportsDryRun: false },
      { command: "project.open", supportsDryRun: false },
      { command: "project.delete", supportsDryRun: false },
      { command: "project.importJson", supportsDryRun: false },
      { command: "layer.create", supportsDryRun: false },
      { command: "layer.rename", supportsDryRun: false },
      { command: "layer.delete", supportsDryRun: false },
      { command: "layer.setVisibility", supportsDryRun: false },
      { command: "layer.setLock", supportsDryRun: false },
      { command: "material.applyToLayer", supportsDryRun: false }
    ]);
  });

  it("keeps command entries unique", () => {
    const names = AUTOMATION_CAPABILITIES.map((capability) => capability.command);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("layer + material capabilities", () => {
  const expected: Array<[string, "read" | "edit", boolean]> = [
    ["layer.list", "read", false],
    ["layer.create", "edit", true],
    ["layer.rename", "edit", true],
    ["layer.delete", "edit", true],
    ["layer.setVisibility", "edit", true],
    ["layer.setLock", "edit", true],
    ["layer.get", "read", false],
    ["material.list", "read", false],
    ["material.applyToLayer", "edit", true]
  ];

  it.each(expected)("declares %s with permission %s and mutates=%s", (command, perm, mutates) => {
    const cap = AUTOMATION_CAPABILITIES.find((c) => c.command === command);
    expect(cap).toBeDefined();
    expect(cap!.requiredPermission).toBe(perm);
    expect(cap!.mutates).toBe(mutates);
    expect(cap!.transports).toEqual(["protocol", "cli"]);
  });

  it("does not declare an mcp transport for any new layer/material command", () => {
    const newCommands = expected.map(([c]) => c);
    for (const command of newCommands) {
      const cap = AUTOMATION_CAPABILITIES.find((c) => c.command === command);
      expect(cap!.transports).not.toContain("mcp");
    }
  });
});
