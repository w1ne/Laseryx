import { createComponentInstance, type ComponentInstance, type ComponentPreset } from "../components/types";
import { preservePlacements } from "../layout/pack";
import type { SheetLayout } from "../layout/types";
import type { Transform } from "../model";
import type { PanelDesign } from "../panel/types";
import { generateEnclosure } from "./generate";
import type { EnclosureGenerationResult, EnclosureParameters, GeneratedEnclosure } from "./types";

export const ENCLOSURE_WORKSPACE_VERSION = 1 as const;

export type CouponState = {
  confirmed: boolean;
  selectedClearance?: number;
};

export type EnclosureWorkspace = {
  version: typeof ENCLOSURE_WORKSPACE_VERSION;
  /** Project-local snapshots of every custom or example preset used by this project. */
  presets: ComponentPreset[];
  sourcePanel: PanelDesign;
  enclosure: {
    /** Stable identity across regenerations. */
    id: string;
    revision: number;
    parameters: EnclosureParameters;
    result?: GeneratedEnclosure;
  };
  coupon: CouponState;
  sheetLayout?: SheetLayout;
};

export function createComponentInstanceFromPreset(preset: ComponentPreset, id: string, transform?: Transform): ComponentInstance {
  return createComponentInstance(preset, id, transform);
}

/** Short compatibility name used by the workflow design. */
export const createInstanceFromPreset = createComponentInstanceFromPreset;

export function addComponentInstance(panel: PanelDesign, instance: ComponentInstance): PanelDesign {
  if (panel.components.some(({ id }) => id === instance.id)) throw new Error(`Duplicate component instance id: ${instance.id}`);
  return { ...panel, components: [...panel.components, structuredClone(instance)] };
}

export function updateComponentInstance(panel: PanelDesign, id: string, changes: Partial<Omit<ComponentInstance, "id" | "kind">>): PanelDesign {
  let found = false;
  const components = panel.components.map((component) => {
    if (component.id !== id) return component;
    found = true;
    return { ...component, ...structuredClone(changes), id: component.id, kind: component.kind } as ComponentInstance;
  });
  if (!found) throw new Error(`Unknown component instance id: ${id}`);
  return { ...panel, components };
}

export function removeComponentInstance(panel: PanelDesign, id: string): PanelDesign {
  return { ...panel, components: panel.components.filter((component) => component.id !== id) };
}

export type WorkspaceRegenerationResult =
  | { ok: true; workspace: EnclosureWorkspace; issues: [] }
  | { ok: false; workspace: EnclosureWorkspace; issues: Extract<EnclosureGenerationResult, { ok: false }>["issues"] };

export function regenerateEnclosureWorkspace(workspace: EnclosureWorkspace): WorkspaceRegenerationResult {
  const generated = generateEnclosure(workspace.sourcePanel, workspace.enclosure.parameters);
  if (!generated.ok) return { ok: false, workspace, issues: generated.issues };
  const parts = generated.enclosure.panels.map(({ id, width, height }) => ({ id, width, height }));
  const sheetLayout = workspace.sheetLayout ? preservePlacements(workspace.sheetLayout, parts) : undefined;
  return {
    ok: true,
    issues: [],
    workspace: {
      ...workspace,
      enclosure: { ...workspace.enclosure, revision: workspace.enclosure.revision + 1, result: generated.enclosure },
      ...(sheetLayout ? { sheetLayout } : {})
    }
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const transform = (value: unknown) => record(value) && ["a", "b", "c", "d", "e", "f"].every((key) => finite(value[key]));
const dimensions = (kind: unknown, value: unknown) => {
  if (!record(value)) return false;
  const keys = kind === "circle" ? ["diameter"] : kind === "slot" ? ["length", "width"]
    : kind === "rectangle" ? ["width", "height"] : kind === "rounded-rectangle" ? ["width", "height", "cornerRadius"]
      : kind === "button-row" ? ["count", "diameter", "pitch"] : [];
  return keys.length > 0 && keys.every((key) => finite(value[key]));
};
const component = (value: unknown, instance: boolean) => record(value) && typeof value.id === "string" && typeof value.name === "string"
  && typeof value.kind === "string" && dimensions(value.kind, value.dimensions)
  && (!instance || (typeof value.presetId === "string" && transform(value.transform)));
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const sheetLayout = (value: unknown) => {
  if (value === undefined) return true;
  if (!record(value) || !record(value.sheetSize) || !finite(value.sheetSize.width) || value.sheetSize.width <= 0
    || !finite(value.sheetSize.height) || value.sheetSize.height <= 0 || (value.orientation !== "landscape" && value.orientation !== "portrait")
    || !finite(value.margin) || value.margin < 0 || !finite(value.gap) || value.gap < 0
    || !Array.isArray(value.parts) || !Array.isArray(value.sheets) || !Array.isArray(value.placements) || !Array.isArray(value.unplacedPartIds)) return false;
  const parts = value.parts;
  const sheets = value.sheets;
  const unplacedPartIds = value.unplacedPartIds;
  if (!parts.every((part) => record(part) && typeof part.id === "string" && part.id.length > 0 && finite(part.width) && part.width > 0 && finite(part.height) && part.height > 0)
    || !sheets.every((sheet) => record(sheet) && typeof sheet.id === "string" && sheet.id.length > 0 && finite(sheet.x) && finite(sheet.y) && finite(sheet.width) && sheet.width > 0 && finite(sheet.height) && sheet.height > 0)) return false;
  const partIds = parts.map((part) => (part as Record<string, unknown>).id as string), sheetIds = sheets.map((sheet) => (sheet as Record<string, unknown>).id as string);
  if (!unique(partIds) || !unique(sheetIds) || !unplacedPartIds.every((id) => typeof id === "string" && partIds.includes(id)) || !unique(unplacedPartIds)) return false;
  const placements = value.placements;
  if (!placements.every((placement) => record(placement) && typeof placement.partId === "string" && partIds.includes(placement.partId)
    && typeof placement.sheetId === "string" && sheetIds.includes(placement.sheetId) && finite(placement.x) && finite(placement.y)
    && (placement.rotation === 0 || placement.rotation === 90))) return false;
  const placedIds = placements.map((placement) => (placement as Record<string, unknown>).partId as string);
  return unique(placedIds) && placedIds.every((id) => !unplacedPartIds.includes(id));
};
const parameters = (value: unknown) => record(value)
  && ["frontHeight", "rearHeight", "thickness", "clearance", "fingerTarget"].every((key) => finite(value[key]));
const PANEL_IDS = ["source-panel", "rear", "left", "right", "base", "service-panel"] as const;
const point = (value: unknown) => record(value) && finite(value.x) && finite(value.y);
const path = (value: unknown) => record(value) && value.closed === true && Array.isArray(value.points) && value.points.length >= 3 && value.points.every(point);
const joint = (value: unknown) => record(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.pairId === "string" && value.pairId.length > 0
  && PANEL_IDS.includes(value.panelId as typeof PANEL_IDS[number]) && ["top", "right", "bottom", "left"].includes(value.edge as string)
  && typeof value.mateId === "string" && value.mateId.length > 0 && finite(value.nominalLength) && value.nominalLength > 0
  && Number.isInteger(value.segmentCount) && (value.segmentCount as number) > 0 && (value.phase === 0 || value.phase === 1)
  && finite(value.depth) && value.depth > 0 && finite(value.matingOffset);
const panel = (value: unknown) => record(value) && PANEL_IDS.includes(value.id as typeof PANEL_IDS[number]) && typeof value.name === "string"
  && finite(value.width) && value.width > 0 && finite(value.height) && value.height > 0 && transform(value.transform)
  && Array.isArray(value.paths) && value.paths.length > 0 && value.paths.every(path) && Array.isArray(value.joints) && value.joints.every(joint)
  && Number.isInteger(value.fingerCount) && (value.fingerCount as number) > 0 && record(value.edgePattern)
  && Number.isInteger(value.edgePattern.horizontal) && (value.edgePattern.horizontal as number) > 0
  && Number.isInteger(value.edgePattern.vertical) && (value.edgePattern.vertical as number) > 0 && (value.edgePattern.phase === 0 || value.edgePattern.phase === 1);
const generatedResult = (value: unknown) => {
  if (value === undefined) return true;
  if (!record(value) || !record(value.input) || !finite(value.input.width) || value.input.width <= 0 || !finite(value.input.depth) || value.input.depth <= 0
    || !parameters(value.input) || !finite(value.slopeDegrees) || !Array.isArray(value.panels) || value.panels.length !== PANEL_IDS.length
    || !value.panels.every(panel) || !Array.isArray(value.joints) || !value.joints.every(joint)) return false;
  const ids = value.panels.map((item) => (item as Record<string, unknown>).id as string);
  const jointIds = value.joints.map((item) => (item as Record<string, unknown>).id as string);
  return unique(ids) && PANEL_IDS.every((id) => ids.includes(id)) && unique(jointIds);
};

/** Reject unknown versions and malformed records; callers may omit them as an explicit migration policy. */
export function sanitizeEnclosureWorkspace(value: unknown): EnclosureWorkspace | undefined {
  if (!record(value) || value.version !== ENCLOSURE_WORKSPACE_VERSION || !Array.isArray(value.presets) || !value.presets.every((item) => component(item, false))
    || !record(value.sourcePanel) || typeof value.sourcePanel.id !== "string" || typeof value.sourcePanel.name !== "string"
    || !finite(value.sourcePanel.width) || !finite(value.sourcePanel.height) || !Array.isArray(value.sourcePanel.components) || !value.sourcePanel.components.every((item) => component(item, true)) || !transform(value.sourcePanel.transform)
    || !record(value.enclosure) || typeof value.enclosure.id !== "string" || !Number.isInteger(value.enclosure.revision) || (value.enclosure.revision as number) < 0
    || !parameters(value.enclosure.parameters) || !generatedResult(value.enclosure.result)
    || !record(value.coupon) || typeof value.coupon.confirmed !== "boolean"
    || (value.coupon.selectedClearance !== undefined && !finite(value.coupon.selectedClearance)) || !sheetLayout(value.sheetLayout)) return undefined;
  try {
    return structuredClone(value) as EnclosureWorkspace;
  } catch {
    return undefined;
  }
}
