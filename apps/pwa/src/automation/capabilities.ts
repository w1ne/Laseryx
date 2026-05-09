import type { AgentPermission } from "./session/types";

export type AutomationCapabilityCategory = "core" | "automation" | "cam" | "ui" | "document" | "project";
export type AutomationCapabilityTransport = "protocol" | "cli" | "mcp";

export type AutomationCapability = {
  command: string;
  category: AutomationCapabilityCategory;
  mutates: boolean;
  supportsDryRun: boolean;
  requiredPermission: AgentPermission;
  transports: AutomationCapabilityTransport[];
  description: string;
};

export const AUTOMATION_CAPABILITIES = [
  {
    command: "inspect",
    category: "core",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "Summarize a Laseryx job without generating G-code."
  },
  {
    command: "preflight",
    category: "core",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "Validate whether a Laseryx job is ready to generate."
  },
  {
    command: "generate",
    category: "core",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "generate",
    transports: ["protocol", "cli", "mcp"],
    description: "Generate preview data, stats, and optional G-code."
  },
  {
    command: "automation.capabilities",
    category: "automation",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "List the supported automation commands and their metadata."
  },
  {
    command: "cam.setOperation",
    category: "cam",
    mutates: true,
    supportsDryRun: true,
    requiredPermission: "edit",
    transports: ["protocol", "cli", "mcp"],
    description: "Update a CAM operation on the active job."
  },
  {
    command: "ui.setActiveTab",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Switch the active Laseryx UI tab."
  },
  {
    command: "ui.setPreviewMode",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Switch the active preview mode."
  },
  {
    command: "ui.selectDesignPanel",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Select the active design-side panel."
  },
  {
    command: "document.listObjects",
    category: "document",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "List document objects and the current selection."
  },
  {
    command: "document.selectObject",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Select a document object."
  },
  {
    command: "document.addRect",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli", "mcp"],
    description: "Add a rectangle object to a document layer."
  },
  {
    command: "document.updateObjectTransform",
    category: "document",
    mutates: true,
    supportsDryRun: true,
    requiredPermission: "edit",
    transports: ["protocol", "cli", "mcp"],
    description: "Update object transform fields without replacing the object."
  },
  {
    command: "document.setObjectLayer",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Move an object to another layer."
  },
  {
    command: "document.deleteObject",
    category: "document",
    mutates: true,
    supportsDryRun: true,
    requiredPermission: "edit",
    transports: ["protocol", "cli", "mcp"],
    description: "Delete a document object."
  },
  {
    command: "project.new",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "project-storage",
    transports: ["protocol", "cli", "mcp"],
    description: "Reset the active browser project to a new default job."
  },
  {
    command: "project.save",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "project-storage",
    transports: ["protocol", "cli", "mcp"],
    description: "Save the active browser project."
  },
  {
    command: "project.list",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "List saved browser projects."
  },
  {
    command: "project.open",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "project-storage",
    transports: ["protocol", "cli", "mcp"],
    description: "Open a saved browser project."
  },
  {
    command: "project.delete",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "project-storage",
    transports: ["protocol", "cli", "mcp"],
    description: "Delete a saved browser project."
  },
  {
    command: "project.summary",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "Summarize the active browser project without exporting full JSON."
  },
  {
    command: "project.exportJson",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli", "mcp"],
    description: "Export the active browser project as JSON."
  },
  {
    command: "project.importJson",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "project-storage",
    transports: ["protocol", "cli", "mcp"],
    description: "Import a Laseryx project JSON object into the browser."
  },
  {
    command: "layer.list",
    category: "document",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli"],
    description: "List document layers with id, name, visibility, lock, op id, and object count."
  },
  {
    command: "layer.create",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Create a new layer with a default Cut operation."
  },
  {
    command: "layer.rename",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Rename a layer addressed by id or name."
  },
  {
    command: "layer.delete",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Delete a layer; refuses if it is the last layer or contains objects."
  },
  {
    command: "layer.setVisibility",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Set a layer's visibility flag."
  },
  {
    command: "layer.setLock",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Set a layer's locked flag."
  },
  {
    command: "layer.get",
    category: "document",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli"],
    description: "Return a full snapshot of a layer including its linked operation fields."
  },
  {
    command: "material.list",
    category: "cam",
    mutates: false,
    supportsDryRun: false,
    requiredPermission: "read",
    transports: ["protocol", "cli"],
    description: "List material presets."
  },
  {
    command: "material.applyToLayer",
    category: "cam",
    mutates: true,
    supportsDryRun: false,
    requiredPermission: "edit",
    transports: ["protocol", "cli"],
    description: "Copy a material preset's fields onto a layer's linked operation; auto-creates the operation if missing."
  }
] as const satisfies readonly AutomationCapability[];

export type AutomationCapabilityCommand = typeof AUTOMATION_CAPABILITIES[number]["command"];

export type AutomationCapabilitiesData = {
  capabilities: AutomationCapability[];
};

export function automationCapabilities(): AutomationCapability[] {
  return AUTOMATION_CAPABILITIES.map((capability) => ({
    ...capability,
    transports: [...capability.transports]
  }));
}

export function getAutomationCommandNames(): AutomationCapabilityCommand[] {
  return AUTOMATION_CAPABILITIES.map((capability) => capability.command);
}

export function protocolAutomationCapabilities(): AutomationCapability[] {
  return automationCapabilities().filter((capability) => capability.transports.includes("protocol"));
}

export function cliAutomationCapabilities(): AutomationCapability[] {
  return automationCapabilities().filter((capability) => capability.transports.includes("cli"));
}

export function liveAutomationCapabilities(): AutomationCapability[] {
  return automationCapabilities().filter((capability) => capability.category !== "core" && capability.category !== "automation");
}

export function mutableAutomationCapabilities(): AutomationCapability[] {
  return automationCapabilities().filter((capability) => capability.mutates);
}

export function isAutomationCommand(command: string): command is AutomationCapabilityCommand {
  return AUTOMATION_CAPABILITIES.some((capability) => capability.command === command);
}

export function permissionForCapability(capability: AutomationCapability): AgentPermission {
  return capability.requiredPermission;
}
