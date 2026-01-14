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

export type Obj = PathObj | ShapeObj;

export type Document = {
  version: number;
  units: Units;
  layers: Layer[];
  objects: Obj[];
};

export type OperationOrder = "insideOut" | "shortestTravel";

export type Operation = {
  id: string;
  type: "vectorCut" | "vectorEngrave";
  speedMmMin: number;
  powerPct: number;
  passes: number;
  order: OperationOrder;
};

export type CamSettings = {
  operations: Operation[];
  global?: {
    curveToleranceMm?: number;
  };
};

export type MachineProfile = {
  bedMm: { w: number; h: number };
  origin: "frontLeft" | "frontRight" | "rearLeft" | "rearRight";
  sRange: { min: number; max: number };
  laserMode: "M3" | "M4";
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
