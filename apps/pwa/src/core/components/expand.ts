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

export function expandComponent(instance: ComponentInstance): PolylinePath[] {
  switch (instance.kind) {
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
  }
}
