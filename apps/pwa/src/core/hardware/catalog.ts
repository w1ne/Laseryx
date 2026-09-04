import type { HardwareModule } from "./types";

export const HACKATHON_KIT: readonly HardwareModule[] = [
  {
    sku: "100.491.54", partNumber: "IPS-1.9-ST7789-SPI-M", name: "1.9-inch IPS display",
    quantity: 6, mounting: "panel", geometry: "display", confidence: "verified",
    dimensions: { boardWidth: 62, boardHeight: 29, cutoutWidth: 43.72, cutoutHeight: 23.695 }
  },
  {
    sku: "100.357.19", partNumber: "RC-40-20/FF", name: "40-way ribbon cable",
    quantity: 6, mounting: "internal", geometry: "none", confidence: "verified", dimensions: {},
    note: "Internal wiring; no panel cutout."
  },
  {
    sku: "100.431.82", partNumber: "INMP441-M", name: "I²S microphone module",
    quantity: 6, mounting: "internal", geometry: "none", confidence: "datasheet", dimensions: {},
    note: "Internal by default; add a custom acoustic opening only after measuring the board."
  },
  {
    sku: "100.355.72", partNumber: "ROT-1AB", name: "Rotary encoder",
    quantity: 6, mounting: "panel", geometry: "round", confidence: "verified",
    dimensions: { shaftDiameter: 6, cutoutDiameter: 7 }
  },
  {
    sku: "100.220.17", partNumber: "KNX1 (ST302, MTS-1)", name: "Two-position toggle switch",
    quantity: 6, mounting: "panel", geometry: "round", confidence: "verified",
    dimensions: { bodyWidth: 12.5, bodyHeight: 6.5, bodyDepth: 9.5, cutoutDiameter: 6, leverHeight: 11 }
  },
  {
    sku: "100.321.00", partNumber: "CDE23N-60-B10K", name: "60 mm slide potentiometer",
    quantity: 6, mounting: "panel", geometry: "slot", confidence: "verified",
    dimensions: { bodyWidth: 88, bodyHeight: 12.5, bodyDepth: 11, travel: 60, slotWidth: 4 }
  },
  {
    sku: "100.519.82", partNumber: "TACTS-12MOD-4CH", name: "Four-button module",
    quantity: 6, mounting: "panel", geometry: "button-row", confidence: "measure",
    dimensions: {}, requiresMeasurement: true,
    note: "Measure button pitch, cap diameter, board envelope, and mounting holes with calipers."
  }
] as const;

export function getHardwareModule(sku: string): HardwareModule | undefined {
  return HACKATHON_KIT.find((item) => item.sku === sku);
}
