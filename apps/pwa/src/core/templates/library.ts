import type { TemplateEntry } from "./types";

/**
 * Fusion-style sketch tools.
 * Construction geometry is decorative — never burned.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "rect",
    name: "Rectangle",
    category: "shape",
    icon: "rect",
    tags: ["rect", "box", "square"],
    description: "Rectangle — set W × H after place",
    place: { kind: "rect" }
  },
  {
    id: "circle",
    name: "Circle",
    category: "hole",
    icon: "hole",
    tags: ["circle", "hole", "round"],
    description: "Circle — set diameter after place",
    place: { kind: "macro", defId: "mount-hole" }
  },
  {
    id: "line",
    name: "Line",
    category: "line",
    icon: "line",
    tags: ["line", "path", "cut", "construction", "guide"],
    description: "Line segment — mark Construction in Properties to skip cut",
    place: { kind: "line" }
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
  return ["shape", "hole", "line", "import"];
}
