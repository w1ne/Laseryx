import type { TemplateEntry } from "./types";

/**
 * Sketch primitives + common cut patterns.
 * One of each — set sizes after place. Mirror/rotate for orientation.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "rect",
    name: "Rectangle",
    category: "shape",
    icon: "rect",
    tags: ["rect", "box", "square"],
    description: "Rectangle — drag on the bed; edit W × H in Properties",
    place: { kind: "rect" }
  },
  {
    id: "circle",
    name: "Circle",
    category: "shape",
    icon: "hole",
    tags: ["circle", "hole", "round"],
    description: "Circle / hole — drag from center; set diameter in Properties",
    place: { kind: "macro", defId: "mount-hole" }
  },
  {
    id: "line",
    name: "Line",
    category: "line",
    icon: "line",
    tags: ["line", "path"],
    description: "Line — mark Construction in Properties for guides",
    place: { kind: "line" }
  },
  {
    id: "slot",
    name: "Slot",
    category: "pattern",
    icon: "slot",
    tags: ["slot", "oblong", "stadium", "capsule", "elongated"],
    description: "Slot / stadium hole — set length & width; Mirror or Rot 90 for direction",
    place: { kind: "macro", defId: "slot" }
  },
  {
    id: "round-rect",
    name: "Round rect",
    category: "pattern",
    icon: "round-rect",
    tags: ["rounded", "fillet", "round", "rect"],
    description: "Rounded rectangle — set W, H, corner radius",
    place: { kind: "macro", defId: "round-rect" }
  },
  {
    id: "import",
    name: "Import",
    category: "import",
    icon: "import",
    tags: ["svg", "png", "image", "file"],
    description: "Import SVG or image",
    place: { kind: "import" }
  }
];

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATE_LIBRARY.find((t) => t.id === id);
}

export function listTemplateCategories(): TemplateEntry["category"][] {
  return ["shape", "pattern", "line", "import"];
}
