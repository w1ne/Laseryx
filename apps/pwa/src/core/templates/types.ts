export type TemplateCategory = "shape" | "hole" | "line" | "import";

export type TemplateIcon = "rect" | "hole" | "line" | "construction" | "import";

export type TemplatePlace =
  | { kind: "rect" }
  | { kind: "line"; construction?: boolean }
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
