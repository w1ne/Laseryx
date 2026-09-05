import { HESTORE_COMPONENTS } from "../components/examples";
import type { HardwareDimensions, HardwareModule } from "./types";

function dimensionsFor(definition: typeof HESTORE_COMPONENTS[number]): HardwareDimensions {
  const preset = definition.preset, body = definition.mechanics.body;
  const dimensions: HardwareDimensions = {};
  if (body) { dimensions.bodyWidth = body.width; dimensions.bodyHeight = body.height; if (body.depth !== undefined) dimensions.bodyDepth = body.depth; }
  if (preset?.kind === "circle") dimensions.cutoutDiameter = preset.dimensions.diameter;
  if (preset?.kind === "slot") { dimensions.travel = preset.dimensions.length; dimensions.slotWidth = preset.dimensions.width; }
  if (preset?.kind === "rectangle" || preset?.kind === "rounded-rectangle") { dimensions.cutoutWidth = preset.dimensions.width; dimensions.cutoutHeight = preset.dimensions.height; if (body) { dimensions.boardWidth = body.width; dimensions.boardHeight = body.height; } }
  return dimensions;
}

export const HACKATHON_KIT: readonly HardwareModule[] = HESTORE_COMPONENTS.map((definition) => ({
  sku: definition.sku,
  partNumber: definition.partNumber,
  name: definition.name,
  quantity: 6,
  mounting: definition.mounting,
  geometry: definition.preset?.kind === "rectangle" || definition.preset?.kind === "rounded-rectangle" ? "display" : definition.preset?.kind === "circle" ? "round" : definition.preset?.kind === "slot" ? "slot" : definition.preset?.kind === "button-row" ? "button-row" : "none",
  dimensions: dimensionsFor(definition),
  confidence: definition.mechanics.confidence === "verified" ? "verified" : "measure",
  ...(definition.mechanics.missing?.length ? { requiresMeasurement: true } : {}),
  ...(definition.mechanics.warnings?.length ? { note: definition.mechanics.warnings.join(" ") } : {})
}));

export function getHardwareModule(sku: string): HardwareModule | undefined {
  return HACKATHON_KIT.find((item) => item.sku === sku);
}
