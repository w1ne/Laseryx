import { createComponentInstance, type ComponentInstance, type ComponentPreset } from "../components/types";
import { preservePlacements } from "../layout/pack";
import type { SheetLayout, SheetOrientation, SheetSize } from "../layout/types";
import type { Transform } from "../model";
import type { PanelDesign } from "../panel/types";
import { generateEnclosure } from "./generate";
import type { EnclosureGenerationResult, EnclosureParameters, GeneratedEnclosure } from "./types";

export const ENCLOSURE_WORKSPACE_VERSION = 1 as const;

export type CouponState = {
  /** Legacy field retained only when loading older projects. */
  confirmed?: boolean;
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
  packing?: { sheetSize: SheetSize; orientation: SheetOrientation; margin: number; gap: number };
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
const hole = (value: unknown) => record(value) && finite(value.x) && finite(value.y) && finite(value.diameter) && value.diameter > 0 && (value.label === undefined || typeof value.label === "string");
const mechanics = (value: unknown) => value === undefined || (record(value)
  && ["verified", "measured", "nominal", "required"].includes(value.confidence as string)
  && (value.body === undefined || (record(value.body) && ["width", "height"].every((key) => finite(value.body![key]) && (value.body![key] as number) > 0) && (value.body.depth === undefined || (finite(value.body.depth) && value.body.depth > 0))))
  && (value.frontProtrusion === undefined || (finite(value.frontProtrusion) && value.frontProtrusion >= 0))
  && (value.mountingHoles === undefined || (Array.isArray(value.mountingHoles) && value.mountingHoles.length <= 100 && value.mountingHoles.every(hole)))
  && (value.acousticHole === undefined || hole(value.acousticHole))
  && (value.missing === undefined || (Array.isArray(value.missing) && value.missing.length <= 100 && value.missing.every((item) => typeof item === "string" && item.trim())))
  && (value.warnings === undefined || (Array.isArray(value.warnings) && value.warnings.length <= 100 && value.warnings.every((item) => typeof item === "string"))));
const source = (value: unknown) => value === undefined || (record(value) && ["vendor", "sku", "partNumber", "note", "url"].every((key) => value[key] === undefined || typeof value[key] === "string") && (value.sourceType === undefined || ["vendor", "datasheet", "measured"].includes(value.sourceType as string)));
const dimensions = (kind: unknown, value: unknown) => {
  if (!record(value)) return false;
  const keys = kind === "circle" ? ["diameter"] : kind === "slot" ? ["length", "width"]
    : kind === "rectangle" ? ["width", "height"] : kind === "rounded-rectangle" ? ["width", "height", "cornerRadius"]
      : kind === "button-row" ? ["count", "diameter", "pitch"] : [];
  if (keys.length === 0 || !keys.every((key) => finite(value[key]) && (value[key] as number) > 0)) return false;
  if (kind === "slot" && (value.length as number) < (value.width as number)) return false;
  if (kind === "rounded-rectangle" && (value.cornerRadius as number) > Math.min(value.width as number, value.height as number) / 2) return false;
  if (kind === "button-row" && (!Number.isInteger(value.count) || (value.pitch as number) < (value.diameter as number))) return false;
  if (kind === "button-row" && value.centers !== undefined && (!Array.isArray(value.centers)
    || value.centers.length !== value.count
    || value.centers.length > 100
    || !value.centers.every((center) => record(center) && finite(center.x) && finite(center.y)))) return false;
  return true;
};
const component = (value: unknown, instance: boolean) => record(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.name === "string"
  && typeof value.kind === "string" && dimensions(value.kind, value.dimensions)
  && source(value.source) && mechanics(value.mechanics)
  && (!instance || (typeof value.presetId === "string" && transform(value.transform)));
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const MAX_ITEMS = 1000, MAX_PATHS_PER_PANEL = 100, MAX_POINTS_PER_PATH = 10_000;
const MAX_LAYOUT_COMPARISONS = 100_000;
const sheetLayout = (value: unknown) => {
  if (value === undefined) return true;
  if (!record(value) || !record(value.sheetSize) || !finite(value.sheetSize.width) || value.sheetSize.width <= 0
    || !finite(value.sheetSize.height) || value.sheetSize.height <= 0 || (value.orientation !== "landscape" && value.orientation !== "portrait")
    || !finite(value.margin) || value.margin < 0 || !finite(value.gap) || value.gap < 0
    || !Array.isArray(value.parts) || !Array.isArray(value.sheets) || !Array.isArray(value.placements) || !Array.isArray(value.unplacedPartIds)) return false;
  if (value.parts.length > MAX_ITEMS || value.sheets.length > MAX_ITEMS || value.placements.length > MAX_ITEMS || value.unplacedPartIds.length > MAX_ITEMS) return false;
  const parts = value.parts;
  const sheets = value.sheets;
  const unplacedPartIds = value.unplacedPartIds;
  if (!parts.every((part) => record(part) && typeof part.id === "string" && part.id.length > 0 && finite(part.width) && part.width > 0 && finite(part.height) && part.height > 0)
    || !sheets.every((sheet) => record(sheet) && typeof sheet.id === "string" && sheet.id.length > 0 && finite(sheet.x) && finite(sheet.y) && finite(sheet.width) && sheet.width > 0 && finite(sheet.height) && sheet.height > 0)) return false;
  const partIds = parts.map((part) => (part as Record<string, unknown>).id as string), sheetIds = sheets.map((sheet) => (sheet as Record<string, unknown>).id as string);
  const partIdSet = new Set(partIds), sheetIdSet = new Set(sheetIds), unplacedIdSet = new Set(unplacedPartIds);
  if (partIdSet.size !== partIds.length || sheetIdSet.size !== sheetIds.length || !unplacedPartIds.every((id) => typeof id === "string" && partIdSet.has(id)) || unplacedIdSet.size !== unplacedPartIds.length) return false;
  const placements = value.placements;
  if (!placements.every((placement) => record(placement) && typeof placement.partId === "string" && partIdSet.has(placement.partId)
    && typeof placement.sheetId === "string" && sheetIdSet.has(placement.sheetId) && finite(placement.x) && finite(placement.y)
    && (placement.rotation === 0 || placement.rotation === 90))) return false;
  const placedIds = placements.map((placement) => (placement as Record<string, unknown>).partId as string);
  if (!unique(placedIds) || placedIds.some((id) => unplacedIdSet.has(id)) || placedIds.length + unplacedPartIds.length !== partIds.length) return false;
  const partById = new Map(parts.map((part) => [(part as Record<string, unknown>).id as string, part as Record<string, unknown>]));
  const sheetById = new Map(sheets.map((sheet) => [(sheet as Record<string, unknown>).id as string, sheet as Record<string, unknown>]));
  const boxes = placements.map((placement) => {
    const p = placement as Record<string, unknown>, part = partById.get(p.partId as string)!, sheet = sheetById.get(p.sheetId as string)!;
    const width = p.rotation === 90 ? part.height as number : part.width as number, height = p.rotation === 90 ? part.width as number : part.height as number;
    return { partId: p.partId as string, sheetId: p.sheetId as string, x: p.x as number, y: p.y as number, width, height, sheet };
  });
  if (boxes.some((box) => box.x < value.margin || box.y < value.margin || box.x + box.width > (box.sheet.width as number) - value.margin || box.y + box.height > (box.sheet.height as number) - value.margin)) return false;
  boxes.sort((a, b) => a.sheetId.localeCompare(b.sheetId) || a.x - b.x || a.y - b.y || a.partId.localeCompare(b.partId));
  let active: typeof boxes = [], activeSheet = "", comparisons = 0;
  for (const box of boxes) {
    if (box.sheetId !== activeSheet) { active = []; activeSheet = box.sheetId; }
    for (let index = active.length - 1; index >= 0; index -= 1) if (active[index].x + active[index].width + value.gap <= box.x) active.splice(index, 1);
    for (const other of active) {
      comparisons += 1;
      if (comparisons > MAX_LAYOUT_COMPARISONS) return false;
      if (!(other.y + other.height + value.gap <= box.y || box.y + box.height + value.gap <= other.y)) return false;
    }
    active.push(box);
  }
  return true;
};
const parameters = (value: unknown) => record(value)
  && ["frontHeight", "rearHeight", "thickness", "fingerTarget"].every((key) => finite(value[key]) && (value[key] as number) > 0)
  && finite(value.clearance) && value.clearance >= 0;
const PANEL_IDS = ["source-panel", "rear", "left", "right", "base", "service-panel"] as const;
const point = (value: unknown) => record(value) && finite(value.x) && finite(value.y);
const path = (value: unknown) => record(value) && value.closed === true && Array.isArray(value.points) && value.points.length >= 3 && value.points.length <= MAX_POINTS_PER_PATH && value.points.every(point);
const joint = (value: unknown) => record(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.pairId === "string" && value.pairId.length > 0
  && PANEL_IDS.includes(value.panelId as typeof PANEL_IDS[number]) && ["top", "right", "bottom", "left"].includes(value.edge as string)
  && typeof value.mateId === "string" && value.mateId.length > 0 && finite(value.nominalLength) && value.nominalLength > 0
  && Number.isInteger(value.segmentCount) && (value.segmentCount as number) > 0 && (value.phase === 0 || value.phase === 1)
  && finite(value.depth) && value.depth > 0 && finite(value.matingOffset);
const sameJoint = (a: Record<string, unknown>, b: Record<string, unknown>) => ["id", "pairId", "panelId", "edge", "mateId", "nominalLength", "segmentCount", "phase", "depth", "matingOffset"].every((key) => a[key] === b[key]);
const panel = (value: unknown) => record(value) && PANEL_IDS.includes(value.id as typeof PANEL_IDS[number]) && typeof value.name === "string"
  && finite(value.width) && value.width > 0 && finite(value.height) && value.height > 0 && transform(value.transform)
  && Array.isArray(value.paths) && value.paths.length > 0 && value.paths.length <= MAX_PATHS_PER_PANEL && value.paths.every(path) && Array.isArray(value.joints) && value.joints.length <= MAX_ITEMS && value.joints.every(joint)
  && Number.isInteger(value.fingerCount) && (value.fingerCount as number) > 0 && record(value.edgePattern)
  && Number.isInteger(value.edgePattern.horizontal) && (value.edgePattern.horizontal as number) > 0
  && Number.isInteger(value.edgePattern.vertical) && (value.edgePattern.vertical as number) > 0 && (value.edgePattern.phase === 0 || value.edgePattern.phase === 1);
const generatedResult = (value: unknown) => {
  if (value === undefined) return true;
  if (!record(value) || !record(value.input) || !finite(value.input.width) || value.input.width <= 0 || !finite(value.input.depth) || value.input.depth <= 0
    || !parameters(value.input) || !finite(value.slopeDegrees) || !Array.isArray(value.panels) || value.panels.length !== PANEL_IDS.length
    || !value.panels.every(panel) || !Array.isArray(value.joints) || value.joints.length > MAX_ITEMS || !value.joints.every(joint)) return false;
  const ids = value.panels.map((item) => (item as Record<string, unknown>).id as string);
  const jointIds = value.joints.map((item) => (item as Record<string, unknown>).id as string);
  if (!unique(ids) || !PANEL_IDS.every((id) => ids.includes(id)) || !unique(jointIds)) return false;
  const joints = value.joints as Record<string, unknown>[], byId = new Map(joints.map((item) => [item.id as string, item]));
  const pairCounts = new Map<string, number>(), idsByPanel = new Map<string, Set<string>>(PANEL_IDS.map((id) => [id, new Set()]));
  for (const item of joints) {
    const mate = byId.get(item.mateId as string);
    if (!mate || mate.mateId !== item.id || mate.pairId !== item.pairId || mate.panelId === item.panelId) return false;
    pairCounts.set(item.pairId as string, (pairCounts.get(item.pairId as string) ?? 0) + 1);
    idsByPanel.get(item.panelId as string)!.add(item.id as string);
  }
  if ([...pairCounts.values()].some((count) => count !== 2)) return false;
  for (const item of value.panels as Record<string, unknown>[]) {
    const panelJoints = item.joints as Record<string, unknown>[];
    const expectedIds = idsByPanel.get(item.id as string)!;
    if (panelJoints.length !== expectedIds.size) return false;
    const seen = new Set<string>();
    for (const entry of panelJoints) {
      const id = entry.id as string, canonical = byId.get(id);
      if (seen.has(id) || !expectedIds.has(id) || canonical === undefined || entry.panelId !== item.id || !sameJoint(entry, canonical)) return false;
      seen.add(id);
    }
  }
  return true;
};

/** Reject unknown versions and malformed records; callers may omit them as an explicit migration policy. */
export function sanitizeEnclosureWorkspace(value: unknown): EnclosureWorkspace | undefined {
  if (!record(value) || value.version !== ENCLOSURE_WORKSPACE_VERSION || !Array.isArray(value.presets) || value.presets.length > MAX_ITEMS || !value.presets.every((item) => component(item, false))
    || !record(value.sourcePanel) || typeof value.sourcePanel.id !== "string" || typeof value.sourcePanel.name !== "string"
    || !finite(value.sourcePanel.width) || value.sourcePanel.width <= 0 || !finite(value.sourcePanel.height) || value.sourcePanel.height <= 0 || !Array.isArray(value.sourcePanel.components) || value.sourcePanel.components.length > MAX_ITEMS || !value.sourcePanel.components.every((item) => component(item, true)) || !transform(value.sourcePanel.transform)
    || !record(value.enclosure) || typeof value.enclosure.id !== "string" || !Number.isInteger(value.enclosure.revision) || (value.enclosure.revision as number) < 0
    || !parameters(value.enclosure.parameters) || !generatedResult(value.enclosure.result)
    || !record(value.coupon) || (value.coupon.confirmed !== undefined && typeof value.coupon.confirmed !== "boolean")
    || (value.coupon.selectedClearance !== undefined && (!finite(value.coupon.selectedClearance) || value.coupon.selectedClearance < 0))
    || (value.packing !== undefined && (!record(value.packing) || !record(value.packing.sheetSize) || !finite(value.packing.sheetSize.width) || value.packing.sheetSize.width <= 0 || !finite(value.packing.sheetSize.height) || value.packing.sheetSize.height <= 0 || (value.packing.orientation !== "landscape" && value.packing.orientation !== "portrait") || !finite(value.packing.margin) || value.packing.margin < 0 || !finite(value.packing.gap) || value.packing.gap < 0))
    || !sheetLayout(value.sheetLayout)) return undefined;
  const presetIds = value.presets.map((item) => (item as Record<string, unknown>).id as string);
  const instanceIds = value.sourcePanel.components.map((item) => (item as Record<string, unknown>).id as string);
  const presetIdSet = new Set(presetIds);
  if (presetIdSet.size !== presetIds.length || !unique(instanceIds) || !value.sourcePanel.components.every((item) => presetIdSet.has((item as Record<string, unknown>).presetId as string))) return undefined;
  try {
    const sanitized = structuredClone(value) as EnclosureWorkspace;
    sanitized.coupon = sanitized.coupon.selectedClearance === undefined ? {} : { selectedClearance: sanitized.coupon.selectedClearance };
    return sanitized;
  } catch {
    return undefined;
  }
}
