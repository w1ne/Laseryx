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
const sheetLayout = (value: unknown) => value === undefined || (record(value) && record(value.sheetSize)
  && finite(value.sheetSize.width) && finite(value.sheetSize.height) && (value.orientation === "landscape" || value.orientation === "portrait")
  && finite(value.margin) && finite(value.gap) && Array.isArray(value.parts) && Array.isArray(value.sheets)
  && Array.isArray(value.placements) && Array.isArray(value.unplacedPartIds));
const parameters = (value: unknown) => record(value)
  && ["frontHeight", "rearHeight", "thickness", "clearance", "fingerTarget"].every((key) => finite(value[key]));
const generatedResult = (value: unknown) => value === undefined || (record(value) && record(value.input)
  && finite(value.input.width) && finite(value.input.depth) && parameters(value.input) && finite(value.slopeDegrees)
  && Array.isArray(value.panels) && value.panels.length === 6
  && ["source-panel", "rear", "left", "right", "base", "service-panel"].every((id) => value.panels.some((panel) => record(panel) && panel.id === id && finite(panel.width) && finite(panel.height)))
  && Array.isArray(value.joints));

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
