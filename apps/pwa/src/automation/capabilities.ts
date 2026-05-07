export type AutomationCapabilityCategory = "core" | "automation" | "cam" | "ui" | "document" | "project";
export type AutomationCapabilityTransport = "protocol" | "cli" | "mcp";

export type AutomationCapability = {
  command: string;
  category: AutomationCapabilityCategory;
  mutates: boolean;
  supportsDryRun: boolean;
  transports: AutomationCapabilityTransport[];
  description: string;
};

export const AUTOMATION_CAPABILITIES = [
  {
    command: "inspect",
    category: "core",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Summarize a Laseryx job without generating G-code."
  },
  {
    command: "preflight",
    category: "core",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Validate whether a Laseryx job is ready to generate."
  },
  {
    command: "generate",
    category: "core",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Generate preview data, stats, and optional G-code."
  },
  {
    command: "automation.capabilities",
    category: "automation",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "List the supported automation commands and their metadata."
  },
  {
    command: "cam.setOperation",
    category: "cam",
    mutates: true,
    supportsDryRun: true,
    transports: ["protocol", "cli", "mcp"],
    description: "Update a CAM operation on the active job."
  },
  {
    command: "ui.setActiveTab",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli"],
    description: "Switch the active Laseryx UI tab."
  },
  {
    command: "ui.setPreviewMode",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli"],
    description: "Switch the active preview mode."
  },
  {
    command: "ui.selectDesignPanel",
    category: "ui",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli"],
    description: "Select the active design-side panel."
  },
  {
    command: "document.listObjects",
    category: "document",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "List document objects and the current selection."
  },
  {
    command: "document.selectObject",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli"],
    description: "Select a document object."
  },
  {
    command: "document.addRect",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Add a rectangle object to a document layer."
  },
  {
    command: "document.updateObjectTransform",
    category: "document",
    mutates: true,
    supportsDryRun: true,
    transports: ["protocol", "cli", "mcp"],
    description: "Update object transform fields without replacing the object."
  },
  {
    command: "document.setObjectLayer",
    category: "document",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli"],
    description: "Move an object to another layer."
  },
  {
    command: "document.deleteObject",
    category: "document",
    mutates: true,
    supportsDryRun: true,
    transports: ["protocol", "cli", "mcp"],
    description: "Delete a document object."
  },
  {
    command: "project.new",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Reset the active browser project to a new default job."
  },
  {
    command: "project.save",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Save the active browser project."
  },
  {
    command: "project.list",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "List saved browser projects."
  },
  {
    command: "project.open",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Open a saved browser project."
  },
  {
    command: "project.delete",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Delete a saved browser project."
  },
  {
    command: "project.summary",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Summarize the active browser project without exporting full JSON."
  },
  {
    command: "project.exportJson",
    category: "project",
    mutates: false,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Export the active browser project as JSON."
  },
  {
    command: "project.importJson",
    category: "project",
    mutates: true,
    supportsDryRun: false,
    transports: ["protocol", "cli", "mcp"],
    description: "Import a Laseryx project JSON object into the browser."
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
