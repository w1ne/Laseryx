import type { TemplateEntry } from "./types";

/**
 * One of each figure. Place → set size in Properties.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "rect",
    name: "Rectangle",
    category: "shape",
    icon: "rect",
    tags: ["rect", "box", "square", "shape"],
    description: "Set width and height after place",
    place: { kind: "rect" }
  },
  {
    id: "hole",
    name: "Hole",
    category: "hole",
    icon: "hole",
    tags: ["hole", "circle", "round", "diameter"],
    description: "Set diameter after place",
    place: { kind: "macro", defId: "mount-hole" }
  },
  {
    id: "frame",
    name: "Frame",
    category: "frame",
    icon: "frame",
    tags: ["frame", "plate", "outline"],
    description: "Set width and height after place",
    place: { kind: "macro", defId: "panel" }
  },
  {
    id: "cutout",
    name: "Cutout",
    category: "cutout",
    icon: "cutout",
    tags: ["cutout", "opening", "window"],
    description: "Set width and height after place",
    place: { kind: "macro", defId: "screen" }
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
  return ["shape", "hole", "frame", "cutout", "import"];
}
