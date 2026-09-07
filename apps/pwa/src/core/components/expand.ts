import type { PolylinePath } from "../model";
import { circleToPolyline, roundedRectToPolyline, slotToPolyline } from "../macros/geomHelpers";
import type { ComponentInstance } from "./types";

function centeredRectangle(width: number, height: number): PolylinePath {
  return {
    closed: true,
    points: [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 }
    ]
  };
}

function requirePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
}

function validateDimensions(instance: ComponentInstance): void {
  switch (instance.kind) {
    case "circle":
      requirePositive("Circle diameter", instance.dimensions.diameter);
      break;
    case "slot":
      requirePositive("Slot length", instance.dimensions.length);
      requirePositive("Slot width", instance.dimensions.width);
      if (instance.dimensions.length < instance.dimensions.width) {
        throw new Error("Slot length must be greater than or equal to width");
      }
      break;
    case "rectangle":
      requirePositive("Rectangle width", instance.dimensions.width);
      requirePositive("Rectangle height", instance.dimensions.height);
      break;
    case "rounded-rectangle":
      requirePositive("Rounded rectangle width", instance.dimensions.width);
      requirePositive("Rounded rectangle height", instance.dimensions.height);
      requirePositive("Rounded rectangle corner radius", instance.dimensions.cornerRadius);
      break;
    case "button-row":
      if (!Number.isInteger(instance.dimensions.count) || instance.dimensions.count <= 0) {
        throw new Error("Button count must be a positive integer");
      }
      requirePositive("Button diameter", instance.dimensions.diameter);
      requirePositive("Button pitch", instance.dimensions.pitch);
      break;
  }
}

/**
 * Expands an instance into paths centered on its local origin. The instance
 * transform is deliberately not applied here; panel expansion applies it downstream.
 */
export function expandComponent(instance: ComponentInstance): PolylinePath[] {
  validateDimensions(instance);
  const primary = (() => { switch (instance.kind) {
    case "circle":
      return [circleToPolyline(0, 0, instance.dimensions.diameter / 2, 32)];
    case "slot": {
      const path = slotToPolyline(instance.dimensions.length, instance.dimensions.width);
      return [{ ...path, points: path.points.map(({ x, y }) => ({
        x: x - instance.dimensions.length / 2,
        y: y - instance.dimensions.width / 2
      })) }];
    }
    case "rectangle":
      return [centeredRectangle(instance.dimensions.width, instance.dimensions.height)];
    case "rounded-rectangle":
      return [roundedRectToPolyline(
        -instance.dimensions.width / 2,
        -instance.dimensions.height / 2,
        instance.dimensions.width,
        instance.dimensions.height,
        instance.dimensions.cornerRadius
      )];
    case "button-row": {
      const { count, diameter, pitch } = instance.dimensions;
      return Array.from({ length: count }, (_, index) =>
        circleToPolyline((index - (count - 1) / 2) * pitch, 0, diameter / 2, 32)
      );
    }
  } })();
  const holes = [...(instance.mechanics?.mountingHoles ?? []), ...(instance.mechanics?.acousticHole ? [instance.mechanics.acousticHole] : [])];
  return [...primary, ...holes.map(({ x, y, diameter }) => circleToPolyline(x, y, diameter / 2, 32))];
}
