import type { ComponentInstance } from "../components/types";
import type { PolylinePath, Transform } from "../model";

export type PanelDesign = {
  id: string;
  name: string;
  width: number;
  height: number;
  components: ComponentInstance[];
  /** Canvas placement only. Panel geometry and component positions stay local. */
  transform: Transform;
};

export type ExpandedPanelCutout = {
  componentId: string;
  componentName: string;
  path: PolylinePath;
};

export type PanelExpansion = {
  panelId: string;
  transform: Transform;
  outline: PolylinePath;
  cutouts: ExpandedPanelCutout[];
};

export type PanelIssueSeverity = "error" | "warning";

export type PanelValidationIssue = {
  code:
    | "panel-width-invalid"
    | "panel-height-invalid"
    | "component-dimensions-invalid"
    | "cutout-outside-panel"
    | "cutout-bounds-overlap";
  severity: PanelIssueSeverity;
  panelId: string;
  panelName: string;
  componentIds?: string[];
  componentNames?: string[];
  message: string;
};
