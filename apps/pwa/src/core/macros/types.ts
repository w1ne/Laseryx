import type { PolylinePath } from "../model";

export type MacroParamValue = number | string | boolean;

export type MacroParamSpec = {
  key: string;
  label: string;
  type: "number" | "enum" | "string" | "boolean";
  unit?: "mm";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: MacroParamValue;
  /** Editing this field sets preset → "custom" when a preset param exists. */
  breaksPreset?: boolean;
};

export type MacroCategory = "mount" | "display" | "control" | "panel";

export type MacroDef = {
  id: string;
  defVersion: number;
  name: string;
  category: MacroCategory;
  approxNote?: string;
  params: MacroParamSpec[];
  expand: (params: Record<string, MacroParamValue>) => PolylinePath[];
};

export type MacroDefSummary = {
  id: string;
  name: string;
  category: MacroCategory;
  defVersion: number;
  approxNote?: string;
  params: MacroParamSpec[];
};
