import type { Transform } from "../model";

export type ComponentKind = "circle" | "slot" | "rectangle" | "rounded-rectangle" | "button-row";

export type CircleDimensions = { diameter: number };
export type SlotDimensions = { length: number; width: number };
export type RectangleDimensions = { width: number; height: number };
export type RoundedRectangleDimensions = RectangleDimensions & { cornerRadius: number };
export type ButtonRowDimensions = { count: number; diameter: number; pitch: number };

export type ComponentSource = {
  vendor?: string;
  sku?: string;
  partNumber?: string;
  note?: string;
};

type Preset<K extends ComponentKind, D> = {
  id: string;
  name: string;
  kind: K;
  dimensions: D;
  source?: ComponentSource;
};

export type ComponentPreset =
  | Preset<"circle", CircleDimensions>
  | Preset<"slot", SlotDimensions>
  | Preset<"rectangle", RectangleDimensions>
  | Preset<"rounded-rectangle", RoundedRectangleDimensions>
  | Preset<"button-row", ButtonRowDimensions>;

type Instance<K extends ComponentKind, D> = {
  id: string;
  presetId: string;
  name: string;
  kind: K;
  dimensions: D;
  transform: Transform;
};

export type ComponentInstance =
  | Instance<"circle", CircleDimensions>
  | Instance<"slot", SlotDimensions>
  | Instance<"rectangle", RectangleDimensions>
  | Instance<"rounded-rectangle", RoundedRectangleDimensions>
  | Instance<"button-row", ButtonRowDimensions>;

export const IDENTITY_TRANSFORM: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function createComponentInstance(
  preset: ComponentPreset,
  id: string,
  transform: Transform = IDENTITY_TRANSFORM
): ComponentInstance {
  const common = { id, presetId: preset.id, name: preset.name, transform: { ...transform } };
  switch (preset.kind) {
    case "circle": return { ...common, kind: preset.kind, dimensions: { ...preset.dimensions } };
    case "slot": return { ...common, kind: preset.kind, dimensions: { ...preset.dimensions } };
    case "rectangle": return { ...common, kind: preset.kind, dimensions: { ...preset.dimensions } };
    case "rounded-rectangle": return { ...common, kind: preset.kind, dimensions: { ...preset.dimensions } };
    case "button-row": return { ...common, kind: preset.kind, dimensions: { ...preset.dimensions } };
  }
}
