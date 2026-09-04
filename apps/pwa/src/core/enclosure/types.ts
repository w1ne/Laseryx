import type { PolylinePath, Transform } from "../model";

export type EnclosureInput = { width: number; depth: number; frontHeight: number; rearHeight: number; thickness: number; clearance: number; fingerTarget: number };
export type EnclosurePanel = { id: "front" | "rear" | "left" | "right" | "base" | "service-lid"; name: string; width: number; height: number; paths: PolylinePath[]; transform: Transform; removable?: boolean; fingerCount: number; edgePattern: { horizontal: number; vertical: number; phase: 0 | 1 } };
export type GeneratedEnclosure = { input: EnclosureInput; slopeDegrees: number; panels: EnclosurePanel[] };
