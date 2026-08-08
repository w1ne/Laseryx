import type { TemplateEntry } from "./types";

/**
 * Universal template library — searchable, not product-mode specific.
 * Place via ObjectService based on `place` payload.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "shape-rect",
    name: "Rectangle",
    category: "shape",
    tags: ["rect", "box", "square", "primitive"],
    description: "Basic rectangle shape",
    place: { kind: "rect" }
  },
  {
    id: "shape-circle",
    name: "Circle",
    category: "shape",
    tags: ["circle", "round", "ellipse", "disc"],
    description: "Closed circle cut",
    place: { kind: "macro", defId: "button", params: { diameterMm: 20, clearanceMm: 0 } }
  },
  {
    id: "hole-generic",
    name: "Hole",
    category: "hole",
    tags: ["hole", "mount", "drill", "screw"],
    description: "Circular hole with clearance",
    place: { kind: "macro", defId: "mount-hole" }
  },
  {
    id: "hole-m3",
    name: "Hole M3",
    category: "hole",
    tags: ["m3", "3mm", "screw", "bolt", "metric"],
    description: "≈3 mm nominal + clearance",
    place: { kind: "macro", defId: "mount-hole", params: { diameterMm: 3, clearanceMm: 0.2 } }
  },
  {
    id: "hole-m4",
    name: "Hole M4",
    category: "hole",
    tags: ["m4", "4mm", "screw", "bolt", "metric"],
    description: "≈4 mm nominal + clearance",
    place: { kind: "macro", defId: "mount-hole", params: { diameterMm: 4, clearanceMm: 0.2 } }
  },
  {
    id: "hole-m5",
    name: "Hole M5",
    category: "hole",
    tags: ["m5", "5mm", "screw", "bolt", "metric"],
    description: "≈5 mm nominal + clearance",
    place: { kind: "macro", defId: "mount-hole", params: { diameterMm: 5, clearanceMm: 0.25 } }
  },
  {
    id: "hole-16mm",
    name: "Round 16 mm",
    category: "hole",
    tags: ["16mm", "button", "switch", "arcade", "panel"],
    description: "16 mm round opening (common switch)",
    place: { kind: "macro", defId: "button", params: { diameterMm: 16, clearanceMm: 0.2 } }
  },
  {
    id: "hole-12mm",
    name: "Round 12 mm",
    category: "hole",
    tags: ["12mm", "button", "led", "indicator"],
    description: "12 mm round opening",
    place: { kind: "macro", defId: "button", params: { diameterMm: 12, clearanceMm: 0.2 } }
  },
  {
    id: "hole-22mm",
    name: "Round 22 mm",
    category: "hole",
    tags: ["22mm", "industrial", "switch", "pilot"],
    description: "22 mm industrial switch cutout",
    place: { kind: "macro", defId: "button", params: { diameterMm: 22, clearanceMm: 0.2 } }
  },
  {
    id: "frame-outer",
    name: "Frame",
    category: "frame",
    tags: ["frame", "plate", "outline", "border", "panel"],
    description: "Outer frame with optional corner holes",
    place: { kind: "macro", defId: "panel" }
  },
  {
    id: "frame-100x80",
    name: "Frame 100×80",
    category: "frame",
    tags: ["100", "80", "plate", "small"],
    description: "100×80 mm plate outline",
    place: {
      kind: "macro",
      defId: "panel",
      params: { widthMm: 100, heightMm: 80, includeCornerHoles: true, holeDiameterMm: 3, holeInsetMm: 5 }
    }
  },
  {
    id: "frame-160x120",
    name: "Frame 160×120",
    category: "frame",
    tags: ["160", "120", "plate"],
    description: "160×120 mm plate outline",
    place: {
      kind: "macro",
      defId: "panel",
      params: { widthMm: 160, heightMm: 120, includeCornerHoles: true }
    }
  },
  {
    id: "cutout-rect-holes",
    name: "Cutout + holes",
    category: "cutout",
    tags: ["cutout", "opening", "window", "display", "screen", "module"],
    description: "Rectangle opening with four corner holes",
    place: { kind: "macro", defId: "screen", params: { preset: "custom" } }
  },
  {
    id: "cutout-display-28",
    name: "Display 2.8\"",
    category: "cutout",
    tags: ["display", "tft", "ili9341", "2.8", "lcd", "screen", "module"],
    description: "Approx opening + mounts for 2.8\" modules",
    place: { kind: "macro", defId: "screen", params: { preset: "2.8-ili9341" } }
  },
  {
    id: "import-file",
    name: "Import file",
    category: "import",
    tags: ["svg", "png", "jpg", "image", "vector", "file"],
    description: "Import SVG or image",
    place: { kind: "import" }
  }
];

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATE_LIBRARY.find((t) => t.id === id);
}

export function listTemplateCategories(): TemplateEntry["category"][] {
  return ["shape", "hole", "frame", "cutout", "import"];
}
