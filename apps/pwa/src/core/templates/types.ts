export type TemplateCategory =
  | "shape"
  | "hole"
  | "frame"
  | "cutout"
  | "import";

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
  /** Search keywords (name/category are searched too). */
  tags: string[];
  description: string;
  place: TemplatePlace;
};
