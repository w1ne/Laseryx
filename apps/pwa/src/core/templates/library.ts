import type { TemplateEntry } from "./types";

/**
 * Fusion-style sketch primitives only.
 * One rectangle, one circle — set size after place. No frame/cutout clones.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "rect",
    name: "Rectangle",
    category: "shape",
    icon: "rect",
    tags: ["rect", "box", "square", "frame", "cutout", "plate"],
    description: "Rectangle — set W × H after place",
    place: { kind: "rect" }
  },
  {
    id: "circle",
    name: "Circle",
    category: "hole",
    icon: "hole",
    tags: ["circle", "hole", "round", "diameter"],
    description: "Circle — set diameter after place",
    place: { kind: "macro", defId: "mount-hole" }
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
  return ["shape", "hole", "import"];
}
