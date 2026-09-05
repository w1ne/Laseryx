import type { ComponentPreset } from "./types";

export const EXAMPLE_COMPONENT_PRESETS: readonly ComponentPreset[] = [
  {
    id: "hestore-100.491.54",
    name: "1.9-inch IPS display",
    kind: "rectangle",
    dimensions: { width: 43.72, height: 23.695 },
    source: { vendor: "HESTORE", sku: "100.491.54", partNumber: "IPS-1.9-ST7789-SPI-M" }
  },
  {
    id: "hestore-100.355.72",
    name: "Rotary encoder",
    kind: "circle",
    dimensions: { diameter: 7 },
    source: { vendor: "HESTORE", sku: "100.355.72", partNumber: "ROT-1AB" }
  },
  {
    id: "hestore-100.220.17",
    name: "Two-position toggle switch",
    kind: "circle",
    dimensions: { diameter: 6 },
    source: { vendor: "HESTORE", sku: "100.220.17", partNumber: "KNX1 (ST302, MTS-1)" }
  },
  {
    id: "hestore-100.321.00",
    name: "60 mm slide potentiometer",
    kind: "slot",
    dimensions: { length: 60, width: 4 },
    source: { vendor: "HESTORE", sku: "100.321.00", partNumber: "CDE23N-60-B10K" }
  }
] as const;

// Ribbon and microphone modules are internal-only. The button module is omitted
// until its diameter and pitch are measured, so this example data invents no cutout.
export const EXCLUDED_HESTORE_CUTOUTS = {
  "100.357.19": "internal-only",
  "100.431.82": "internal-only",
  "100.519.82": "button diameter and pitch require measurement"
} as const;

export function getExampleComponentPresetBySku(sku: string): ComponentPreset | undefined {
  return EXAMPLE_COMPONENT_PRESETS.find((preset) => preset.source?.sku === sku);
}
