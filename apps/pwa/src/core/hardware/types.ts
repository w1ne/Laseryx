export type DimensionConfidence = "verified" | "datasheet" | "measure";
export type MountingMode = "panel" | "internal";

export type HardwareDimensions = Record<string, number>;

export type HardwareModule = {
  sku: string;
  partNumber: string;
  name: string;
  quantity: number;
  mounting: MountingMode;
  geometry: "display" | "round" | "slot" | "button-row" | "none";
  dimensions: HardwareDimensions;
  confidence: DimensionConfidence;
  requiresMeasurement?: boolean;
  note?: string;
};
