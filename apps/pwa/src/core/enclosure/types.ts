import type { PolylinePath, Transform } from "../model";

export type EnclosureParameters = { frontHeight: number; rearHeight: number; thickness: number; clearance: number; fingerTarget: number };
export type EnclosureInput = EnclosureParameters & { width: number; depth: number };
export type EnclosurePanelId = "source-panel" | "rear" | "left" | "right" | "base" | "service-panel";
export type EdgeName = "top" | "right" | "bottom" | "left";
export type EdgeJoint = { id: string; pairId: string; panelId: EnclosurePanelId; edge: EdgeName; mateId: string; nominalLength: number; segmentCount: number; phase: 0 | 1; depth: number; matingOffset: number };
export type EnclosurePanel = { id: EnclosurePanelId; name: string; width: number; height: number; paths: PolylinePath[]; transform: Transform; removable?: boolean; joints: EdgeJoint[]; fingerCount: number; edgePattern: { horizontal: number; vertical: number; phase: 0 | 1 } };
export type GeneratedEnclosure = { input: EnclosureInput; slopeDegrees: number; panels: EnclosurePanel[]; joints: EdgeJoint[] };
export type EnclosureValidationIssue = { code: "invalid-dimension" | "impossible-slope" | "edge-too-short" | "joint-geometry-infeasible"; message: string; field?: string; edgeIds?: [string, string] };
export type EnclosureGenerationResult = { ok: true; enclosure: GeneratedEnclosure; issues: [] } | { ok: false; enclosure?: never; issues: EnclosureValidationIssue[] };
