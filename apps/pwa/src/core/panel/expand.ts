import { expandComponent } from "../components/expand";
import { transformPoints } from "../geom";
import type { PanelDesign, PanelExpansion } from "./types";

export function expandPanel(panel: PanelDesign): PanelExpansion {
  return {
    panelId: panel.id,
    transform: { ...panel.transform },
    outline: {
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: panel.width, y: 0 },
        { x: panel.width, y: panel.height },
        { x: 0, y: panel.height }
      ]
    },
    cutouts: panel.components.flatMap((component) =>
      expandComponent(component).map((path) => ({
        componentId: component.id,
        componentName: component.name,
        path: { ...path, points: transformPoints(path.points, component.transform) }
      }))
    )
  };
}
