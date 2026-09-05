export type SheetOrientation = "landscape" | "portrait";
export type PartBounds = Readonly<{ id: string; width: number; height: number }>;
export type SheetSize = Readonly<{ width: number; height: number }>;
export type Sheet = Readonly<{ id: string; x: number; y: number; width: number; height: number }>;
export type Placement = Readonly<{ partId: string; sheetId: string; x: number; y: number; rotation: 0 | 90 }>;
export type SheetLayout = Readonly<{
  sheetSize: SheetSize; orientation: SheetOrientation; margin: number; gap: number;
  parts: readonly PartBounds[]; sheets: readonly Sheet[]; placements: readonly Placement[];
  unplacedPartIds: readonly string[];
}>;
export type PackOptions = Readonly<{ sheetSize?: SheetSize; orientation?: SheetOrientation; margin?: number; gap?: number }>;
