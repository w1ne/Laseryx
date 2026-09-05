import { expandComponent } from "../components/expand";
import { applyTransform } from "../geom";
import type { ComponentInstance } from "../components/types";
import type { Point, Transform } from "../model";
import type { PanelDesign, PanelValidationIssue } from "./types";
import { validateMechanics } from "../components/mechanics";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
const TRANSFORM_COEFFICIENTS: Array<keyof Transform> = ["a", "b", "c", "d", "e", "f"];

function boundsFromPoints(points: Point[]): Bounds {
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y))
  };
}

function transformedRectangleBounds(width: number, height: number, transform: Transform): Bounds {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return boundsFromPoints([
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ].map((point) => applyTransform(point, transform)));
}

function transformedCircleBounds(centerX: number, radius: number, transform: Transform): Bounds {
  const center = applyTransform({ x: centerX, y: 0 }, transform);
  const extentX = radius * Math.hypot(transform.a, transform.c);
  const extentY = radius * Math.hypot(transform.b, transform.d);
  return {
    minX: center.x - extentX,
    minY: center.y - extentY,
    maxX: center.x + extentX,
    maxY: center.y + extentY
  };
}

function unionBounds(bounds: Bounds[]): Bounds {
  return {
    minX: Math.min(...bounds.map(({ minX }) => minX)),
    minY: Math.min(...bounds.map(({ minY }) => minY)),
    maxX: Math.max(...bounds.map(({ maxX }) => maxX)),
    maxY: Math.max(...bounds.map(({ maxY }) => maxY))
  };
}

/** Exact for circles, rectangles and button rows; conservative for curved rectangular primitives. */
function componentBounds(component: ComponentInstance): Bounds {
  const { transform } = component;
  let primary: Bounds;
  switch (component.kind) {
    case "circle":
      primary = transformedCircleBounds(0, component.dimensions.diameter / 2, transform); break;
    case "slot":
      primary = transformedRectangleBounds(component.dimensions.length, component.dimensions.width, transform); break;
    case "rectangle":
    case "rounded-rectangle":
      primary = transformedRectangleBounds(component.dimensions.width, component.dimensions.height, transform); break;
    case "button-row": {
      const { count, diameter, pitch } = component.dimensions;
      primary = unionBounds(Array.from({ length: count }, (_, index) =>
        transformedCircleBounds((index - (count - 1) / 2) * pitch, diameter / 2, transform)
      )); break;
    }
  }
  const holes = [...(component.mechanics?.mountingHoles ?? []), ...(component.mechanics?.acousticHole ? [component.mechanics.acousticHole] : [])];
  return holes.length ? unionBounds([primary, ...holes.map((hole) => {
    const center = applyTransform({ x: hole.x, y: hole.y }, transform);
    const radius = hole.diameter / 2;
    return { minX: center.x - radius * Math.hypot(transform.a, transform.c), maxX: center.x + radius * Math.hypot(transform.a, transform.c), minY: center.y - radius * Math.hypot(transform.b, transform.d), maxY: center.y + radius * Math.hypot(transform.b, transform.d) };
  })]) : primary;
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
    const invalidCoefficient = TRANSFORM_COEFFICIENTS
      .find((coefficient) => !Number.isFinite(component.transform[coefficient]));
    if (invalidCoefficient) {
      issues.push({
        ...baseIssue(panel),
        code: "component-transform-invalid",
        severity: "error",
        componentIds: [component.id],
        componentNames: [component.name],
        message: `${component.name} transform coefficient ${invalidCoefficient} must be finite.`
      });
      continue;
    }
    try {
      const mechanicalIssues = validateMechanics(component.mechanics);
      if (mechanicalIssues.length) throw new Error(mechanicalIssues.join(" "));
      // Component expansion owns the complete dimension validation contract.
      expandComponent(component);
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
          severity: "error",
          componentIds: [first.component.id, second.component.id],
          componentNames: [first.component.name, second.component.name],
          message: `${first.component.name} and ${second.component.name} bounds overlap; inspect their cutout geometry.`
        });
      }
    }
  }

  return issues;
}
