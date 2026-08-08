export type Units = "mm";

export type Point = {
  x: number;
  y: number;
};

export type Transform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  operationId?: string;
};

export type RectShape = {
  type: "rect";
  width: number;
  height: number;
};

export type Shape = RectShape;

export type PathObj = {
  kind: "path";
  id: string;
  layerId: string;
  closed: boolean;
  transform: Transform;
  points: Point[];
};

export type ShapeObj = {
  kind: "shape";
  id: string;
  layerId: string;
  transform: Transform;
  shape: Shape;
};

export type ImageObj = {
  kind: "image";
  id: string;
  layerId: string;
  transform: Transform;
  width: number;
  height: number;
  // Data URI or blob URL
  src: string;
};

/** Parametric hardware part instance (screen, hole, button, panel, …). */
export type MacroObj = {
  kind: "macro";
  id: string;
  layerId: string;
  transform: Transform;
  defId: string;
  /** Catalog def version frozen when placed/updated. */
  defVersion: number;
  params: Record<string, number | string | boolean>;
};

export type Obj = PathObj | ShapeObj | ImageObj | MacroObj;

/** Alias used by some UI components. */
export type DocumentObject = Obj;

export type Document = {
  version: number;
  units: Units;
  layers: Layer[];
  objects: Obj[];
};

export type OperationOrder = "insideOut" | "shortestTravel" | "topDown";

export type OperationMode = "line" | "fill";

export type Operation = {
  id: string;
  name: string; // New field for user friendliness
  mode: OperationMode;
  speed: number; // Simplified from speedMmMin
  power: number; // Simplified from powerPct
  passes: number;

  // Fill specific settings
  lineInterval?: number;
  angle?: number;

  // Legacy support or advanced
  order?: OperationOrder;
};

export type CamSettings = {
  operations: Operation[];
  optimizePaths?: boolean; // Default: true
  global?: {
    curveToleranceMm?: number;
  };
};

export type MachineProfile = {
  id: string;   // Unique ID
  name: string; // User-friendly name
  bedMm: { w: number; h: number };
  origin: "frontLeft" | "frontRight" | "rearLeft" | "rearRight";
  sRange: { min: number; max: number };
  laserMode: "M3" | "M4";
  baudRate: number; // Device baud rate
  preamble?: string[];
  postamble?: string[];
};

export type GcodeDialect = {
  newline: "\n" | "\r\n";
  useG0ForTravel: boolean;
  powerCommand: "S";
  enableLaser: "M3" | "M4";
  disableLaser: "M5";
};

export type PolylinePath = {
  points: Point[];
  closed: boolean;
};

export type PlannedOp = {
  opId: string;
  kind: "vector";
  paths: PolylinePath[];
};

export type CamPlan = {
  ops: PlannedOp[];
};

export type PreviewGeom = {
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  vector: PolylinePath[];
};

export type JobStats = {
  estTimeS: number;
  travelMm: number;
  markMm: number;
  segments: number;
};

export type MaterialPreset = {
  id: string;
  name: string;
  mode: OperationMode;
  speed: number;
  power: number;
  passes: number;
  lineInterval?: number;
  angle?: number;
};
