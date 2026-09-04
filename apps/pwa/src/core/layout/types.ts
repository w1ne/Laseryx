export type PackPart = { id: string; width: number; height: number };
export type SheetSettings = { width: number; height: number; margin: number; gap: number; allowRotation: boolean };
export type Placement = PackPart & { x: number; y: number; rotated: boolean };
export type PackedSheet = { id: string; width: number; height: number; placements: Placement[] };
