import type { TemplateEntry } from "./types";

/**
 * Small universal library. One Hole — set diameter after place.
 */
export const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    id: "shape-rect",
    name: "Rectangle",
    category: "shape",
    tags: ["rect", "box", "square"],
    description: "Rectangle",
    place: { kind: "rect" }
  },
  {
    id: "hole",
    name: "Hole",
    category: "hole",
    tags: ["hole", "circle", "round", "drill", "screw", "diameter"],
    description: "Round hole — set diameter in Properties",
    place: { kind: "macro", defId: "mount-hole" }
  },
  {
    id: "frame",
    name: "Frame",
    category: "frame",
    tags: ["frame", "plate", "outline"],
    description: "Outer frame / plate",
    place: { kind: "macro", defId: "panel" }
  },
  {
    id: "cutout",
    name: "Cutout",
    category: "cutout",
    tags: ["cutout", "opening", "window", "display"],
    description: "Rectangle opening with corner holes",
    place: { kind: "macro", defId: "screen", params: { preset: "custom" } }
  },
  {
    id: "import-file",
    name: "Import",
    category: "import",
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
