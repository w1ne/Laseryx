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
      "project.importJson"
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
      { command: "project.importJson", supportsDryRun: false }
    ]);
  });

  it("keeps command entries unique", () => {
    const names = AUTOMATION_CAPABILITIES.map((capability) => capability.command);
    expect(new Set(names).size).toBe(names.length);
  });
});
