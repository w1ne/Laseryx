import { validatePanel } from "../panel/validate";
import { hasSelfIntersection } from "./joints";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "./workspace";

export type EnclosureIssueCode = "INVALID_STOCK" | "MEASURE_REQUIRED" | "OUTSIDE_SHEET" | "PART_OVERLAP" | "COUPON_UNCONFIRMED" | "COMPONENT_DIMENSIONS_INVALID" | "COMPONENT_TRANSFORM_INVALID" | "CUTOUT_OUTSIDE_PANEL" | "CUTOUT_OVERLAP" | "JOINT_TOO_SHORT" | "JOINT_INFEASIBLE" | "CONTOUR_OPEN" | "CONTOUR_SELF_INTERSECTION" | "CUTOUT_JOINT_COLLISION" | "PART_UNPLACED" | "PLACEMENT_OUT_OF_BOUNDS" | "PLACEMENT_OVERLAP" | "PLACEMENT_DUPLICATE" | "STOCK_PROFILE_MISMATCH" | "WORKSPACE_INCOMPLETE" | "REVIEW_WARNING";
export type EnclosureIssue = { code: EnclosureIssueCode; severity: "error" | "warning"; message: string; objectIds?: string[] };
export type LegacyEnclosurePreflightInput = { thickness: number; couponConfirmed: boolean; unknownMeasurements: string[]; overflowPartIds: string[]; overlappingPartIds: string[] };
export type WorkspacePreflightInput = { workspace: EnclosureWorkspace; unknownMeasurements?: string[]; warnings?: string[]; stockProfile?: { id?: string; thickness?: number; width?: number; height?: number }; machineProfile?: { id?: string; bedMm?: { w: number; h: number }; stockThickness?: number } };
export type EnclosurePreflightInput = LegacyEnclosurePreflightInput | WorkspacePreflightInput;

const panelCode: Record<string, EnclosureIssueCode> = { "component-dimensions-invalid": "COMPONENT_DIMENSIONS_INVALID", "component-transform-invalid": "COMPONENT_TRANSFORM_INVALID", "cutout-outside-panel": "CUTOUT_OUTSIDE_PANEL", "cutout-bounds-overlap": "CUTOUT_OVERLAP", "panel-width-invalid": "COMPONENT_DIMENSIONS_INVALID", "panel-height-invalid": "COMPONENT_DIMENSIONS_INVALID" };

function workspaceIssues(input: WorkspacePreflightInput): EnclosureIssue[] {
  const { workspace } = input, issues: EnclosureIssue[] = [];
  for (const issue of validatePanel(workspace.sourcePanel)) issues.push({ code: panelCode[issue.code], severity: "error", message: issue.message, objectIds: issue.componentIds });
  const generated = regenerateEnclosureWorkspace({ ...workspace, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined });
  if (!generated.ok) for (const issue of generated.issues) {
    const code: EnclosureIssueCode = issue.code === "edge-too-short" ? "JOINT_TOO_SHORT" : issue.code === "joint-geometry-infeasible" ? "JOINT_INFEASIBLE" : issue.code === "cutout-joint-collision" ? "CUTOUT_JOINT_COLLISION" : issue.code === "source-panel-invalid" ? (panelCode[issue.causeCode ?? ""] ?? "WORKSPACE_INCOMPLETE") : "WORKSPACE_INCOMPLETE";
    if (!issues.some((existing) => existing.code === code && existing.message === issue.message)) issues.push({ code, severity: "error", message: `Cannot make box: ${issue.message}.`, objectIds: issue.componentIds });
  }
  const result = workspace.enclosure.result;
  if (!result) issues.push({ code: "WORKSPACE_INCOMPLETE", severity: "error", message: "Make the box faces before starting the cut." });
  else for (const panel of result.panels) for (const path of panel.paths) {
    if (!path.closed) issues.push({ code: "CONTOUR_OPEN", severity: "error", message: `${panel.name} has an open contour; close it before cutting.`, objectIds: [panel.id] });
    else if (hasSelfIntersection(path)) issues.push({ code: "CONTOUR_SELF_INTERSECTION", severity: "error", message: `${panel.name} has a self-intersecting contour; repair it before cutting.`, objectIds: [panel.id] });
  }
  const layout = workspace.sheetLayout;
  if (result && !layout) issues.push({ code: "PART_UNPLACED", severity: "error", message: "Arrange the generated box faces on sheets before cutting." });
  if (layout) {
    if (layout.unplacedPartIds.length) issues.push({ code: "PART_UNPLACED", severity: "error", message: `Arrange unplaced parts: ${layout.unplacedPartIds.join(", ")}.`, objectIds: [...layout.unplacedPartIds] });
    const seen = new Set<string>(), parts = new Map(layout.parts.map((p) => [p.id, p])), sheets = new Map(layout.sheets.map((s) => [s.id, s]));
    const boxes: Array<{ id: string; sheetId: string; x: number; y: number; w: number; h: number }> = [];
    for (const placement of layout.placements) {
      if (seen.has(placement.partId)) issues.push({ code: "PLACEMENT_DUPLICATE", severity: "error", message: `${placement.partId} is placed more than once; remove the duplicate placement.`, objectIds: [placement.partId] });
      seen.add(placement.partId);
      const part = parts.get(placement.partId), sheet = sheets.get(placement.sheetId);
      if (!part || !sheet) { issues.push({ code: "PLACEMENT_OUT_OF_BOUNDS", severity: "error", message: `${placement.partId} refers to a missing part or sheet.`, objectIds: [placement.partId] }); continue; }
      const w = placement.rotation === 90 ? part.height : part.width, h = placement.rotation === 90 ? part.width : part.height;
      if (placement.x < layout.margin || placement.y < layout.margin || placement.x + w > sheet.width - layout.margin || placement.y + h > sheet.height - layout.margin) issues.push({ code: "PLACEMENT_OUT_OF_BOUNDS", severity: "error", message: `${placement.partId} crosses the boundary of ${placement.sheetId}.`, objectIds: [placement.partId] });
      boxes.push({ id: placement.partId, sheetId: placement.sheetId, x: placement.x, y: placement.y, w, h });
    }
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) if (boxes[a].sheetId === boxes[b].sheetId && boxes[a].x < boxes[b].x + boxes[b].w + layout.gap && boxes[a].x + boxes[a].w + layout.gap > boxes[b].x && boxes[a].y < boxes[b].y + boxes[b].h + layout.gap && boxes[a].y + boxes[a].h + layout.gap > boxes[b].y) issues.push({ code: "PLACEMENT_OVERLAP", severity: "error", message: `${boxes[a].id} overlaps ${boxes[b].id} on ${boxes[a].sheetId}.`, objectIds: [boxes[a].id, boxes[b].id] });
  }
  if (input.stockProfile?.thickness !== undefined && input.stockProfile.thickness !== workspace.enclosure.parameters.thickness) issues.push({ code: "STOCK_PROFILE_MISMATCH", severity: "error", message: `Selected stock thickness ${input.stockProfile.thickness} mm does not match the box thickness ${workspace.enclosure.parameters.thickness} mm.` });
  if (input.stockProfile?.id && input.machineProfile?.id && input.stockProfile.id !== input.machineProfile.id) issues.push({ code: "STOCK_PROFILE_MISMATCH", severity: "error", message: `Selected stock profile ${input.stockProfile.id} does not match machine profile ${input.machineProfile.id}.` });
  if (workspace.coupon.selectedClearance !== undefined && !workspace.coupon.confirmed) issues.push({ code: "COUPON_UNCONFIRMED", severity: "warning", message: "Confirm the included fit coupon result before cutting the enclosure." });
  for (const name of input.unknownMeasurements ?? []) issues.push({ code: "MEASURE_REQUIRED", severity: "error", message: `Enter the measured dimensions for ${name}.`, objectIds: [name] });
  for (const warning of input.warnings ?? []) issues.push({ code: "REVIEW_WARNING", severity: "warning", message: warning });
  return issues;
}

export function preflightEnclosure(input: EnclosurePreflightInput): { ready: boolean; issues: EnclosureIssue[] } {
  if ("workspace" in input) {
    const issues = workspaceIssues(input);
    return { ready: !issues.some(({ severity, code }) => severity === "error" || code === "COUPON_UNCONFIRMED"), issues };
  }
  const issues: EnclosureIssue[] = [];
  if (!Number.isFinite(input.thickness) || input.thickness <= 0) issues.push({ code: "INVALID_STOCK", severity: "error", message: "Stock thickness must be measured and greater than zero." });
  if (input.unknownMeasurements.length) issues.push({ code: "MEASURE_REQUIRED", severity: "error", message: `Enter measured dimensions for ${input.unknownMeasurements.join(", ")}.`, objectIds: input.unknownMeasurements });
  if (input.overflowPartIds.length) issues.push({ code: "OUTSIDE_SHEET", severity: "error", message: `Parts outside the selected sheet: ${input.overflowPartIds.join(", ")}.`, objectIds: input.overflowPartIds });
  if (input.overlappingPartIds.length) issues.push({ code: "PART_OVERLAP", severity: "error", message: `Packed parts overlap: ${input.overlappingPartIds.join(", ")}.`, objectIds: input.overlappingPartIds });
  if (!input.couponConfirmed) issues.push({ code: "COUPON_UNCONFIRMED", severity: "warning", message: "Cut and test the fit coupon before the enclosure." });
  return { ready: issues.length === 0, issues };
}
