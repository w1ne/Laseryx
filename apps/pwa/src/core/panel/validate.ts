import { expandComponent } from "../components/expand";
import { computeBounds, transformPoints } from "../geom";
import type { ComponentInstance } from "../components/types";
import type { PanelDesign, PanelValidationIssue } from "./types";

type Bounds = ReturnType<typeof computeBounds>;

function componentBounds(component: ComponentInstance): Bounds {
  return computeBounds(expandComponent(component).map((path) => ({
    ...path,
    points: transformPoints(path.points, component.transform)
  })));
}

function boundsOverlap(first: Bounds, second: Bounds): boolean {
  return first.minX < second.maxX
    && first.maxX > second.minX
    && first.minY < second.maxY
    && first.maxY > second.minY;
}

function baseIssue(panel: PanelDesign): Pick<PanelValidationIssue, "panelId" | "panelName"> {
  return { panelId: panel.id, panelName: panel.name };
}

export function validatePanel(panel: PanelDesign): PanelValidationIssue[] {
  const issues: PanelValidationIssue[] = [];
  const widthValid = Number.isFinite(panel.width) && panel.width > 0;
  const heightValid = Number.isFinite(panel.height) && panel.height > 0;

  if (!widthValid) {
    issues.push({
      ...baseIssue(panel),
      code: "panel-width-invalid",
      severity: "error",
      message: `${panel.name} width must be finite and positive.`
    });
  }
  if (!heightValid) {
    issues.push({
      ...baseIssue(panel),
      code: "panel-height-invalid",
      severity: "error",
      message: `${panel.name} height must be finite and positive.`
    });
  }

  const validComponents: Array<{ component: ComponentInstance; bounds: Bounds }> = [];
  for (const component of panel.components) {
    try {
      validComponents.push({ component, bounds: componentBounds(component) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "dimensions are invalid";
      issues.push({
        ...baseIssue(panel),
        code: "component-dimensions-invalid",
        severity: "error",
        componentIds: [component.id],
        componentNames: [component.name],
        message: `${component.name} has invalid dimensions: ${reason}.`
      });
    }
  }

  if (widthValid && heightValid) {
    for (const { component, bounds } of validComponents) {
      if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > panel.width || bounds.maxY > panel.height) {
        issues.push({
          ...baseIssue(panel),
          code: "cutout-outside-panel",
          severity: "error",
          componentIds: [component.id],
          componentNames: [component.name],
          message: `${component.name} crosses the usable boundary of ${panel.name}.`
        });
      }
    }
  }

  for (let firstIndex = 0; firstIndex < validComponents.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < validComponents.length; secondIndex += 1) {
      const first = validComponents[firstIndex];
      const second = validComponents[secondIndex];
      if (boundsOverlap(first.bounds, second.bounds)) {
        issues.push({
          ...baseIssue(panel),
          code: "cutout-bounds-overlap",
          severity: "warning",
          componentIds: [first.component.id, second.component.id],
          componentNames: [first.component.name, second.component.name],
          message: `${first.component.name} and ${second.component.name} bounds overlap; inspect their cutout geometry.`
        });
      }
    }
  }

  return issues;
}
