export type TemplateCategory = "shape" | "hole" | "frame" | "cutout" | "import";

export type TemplateIcon = "rect" | "hole" | "frame" | "cutout" | "import";

export type TemplatePlace =
  | { kind: "rect" }
  | { kind: "import" }
  | {
      kind: "macro";
      defId: string;
      params?: Record<string, number | string | boolean>;
    };

export type TemplateEntry = {
  id: string;
  name: string;
  category: TemplateCategory;
  icon: TemplateIcon;
  tags: string[];
  description: string;
  place: TemplatePlace;
};
