export type TemplateCategory = "shape" | "pattern" | "line" | "import";

export type TemplateIcon = "rect" | "hole" | "line" | "slot" | "round-rect" | "import";

export type TemplatePlace =
  | { kind: "rect" }
  | { kind: "line" }
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
