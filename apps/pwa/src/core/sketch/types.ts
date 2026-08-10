/** 2D parametric sketch graph (primary drafting model). */

export type SketchPointId = string;
export type SketchEntityId = string;
export type SketchConstraintId = string;
export type SketchParamId = string;

export type SketchPoint = {
  id: SketchPointId;
  x: number;
  y: number;
};

export type SketchLine = {
  kind: "line";
  id: SketchEntityId;
  p1: SketchPointId;
  p2: SketchPointId;
  construction?: boolean;
  layerId?: string;
  /** Display name in object list. */
  name?: string;
};

export type SketchCircle = {
  kind: "circle";
  id: SketchEntityId;
  center: SketchPointId;
  /** Radius in mm; may be driven by diameter/radius constraints. */
  r: number;
  construction?: boolean;
  layerId?: string;
  name?: string;
};

export type SketchEntity = SketchLine | SketchCircle;

export type SketchParameter = {
  id: SketchParamId;
  name: string;
  value: number;
};

/** Dimensional value: literal mm or named parameter. */
export type DimValue =
  | { kind: "literal"; value: number }
  | { kind: "param"; paramId: SketchParamId };

export type SketchConstraint =
  | { id: SketchConstraintId; type: "fix"; pointId: SketchPointId }
  | {
      id: SketchConstraintId;
      type: "coincident";
      a: SketchPointId;
      b: SketchPointId;
    }
  | { id: SketchConstraintId; type: "horizontal"; lineId: SketchEntityId }
  | { id: SketchConstraintId; type: "vertical"; lineId: SketchEntityId }
  | {
      id: SketchConstraintId;
      type: "parallel";
      lineA: SketchEntityId;
      lineB: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "perpendicular";
      lineA: SketchEntityId;
      lineB: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "equalLength";
      lineA: SketchEntityId;
      lineB: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "equalRadius";
      circleA: SketchEntityId;
      circleB: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "pointOnLine";
      pointId: SketchPointId;
      lineId: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "pointOnCircle";
      pointId: SketchPointId;
      circleId: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "midpoint";
      pointId: SketchPointId;
      lineId: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "concentric";
      circleA: SketchEntityId;
      circleB: SketchEntityId;
    }
  | {
      id: SketchConstraintId;
      type: "distance";
      a: SketchPointId;
      b: SketchPointId;
      value: DimValue;
      /** Display: signed offset of dim line along segment perpendicular (mm). */
      offsetMm?: number;
    }
  /** Signed perpendicular distance from point to infinite line (Fusion point–line dim). */
  | {
      id: SketchConstraintId;
      type: "pointLineDistance";
      pointId: SketchPointId;
      lineId: SketchEntityId;
      value: DimValue;
      /** Display: shift along the parent line direction (mm). */
      offsetMm?: number;
    }
  | {
      id: SketchConstraintId;
      type: "length";
      lineId: SketchEntityId;
      value: DimValue;
      /** Display: signed offset of dim line along line perpendicular (mm). */
      offsetMm?: number;
    }
  | {
      id: SketchConstraintId;
      type: "diameter";
      circleId: SketchEntityId;
      value: DimValue;
      /** Display: radial offset of dim line beyond radius (mm). */
      offsetMm?: number;
    }
  | {
      id: SketchConstraintId;
      type: "radius";
      circleId: SketchEntityId;
      value: DimValue;
      offsetMm?: number;
    };

export type SketchDocument = {
  version: 1;
  points: Record<SketchPointId, SketchPoint>;
  entities: Record<SketchEntityId, SketchEntity>;
  constraints: Record<SketchConstraintId, SketchConstraint>;
  parameters: Record<SketchParamId, SketchParameter>;
};

export type SolveStatus = {
  ok: boolean;
  iterations: number;
  residual: number;
  /** Rough: nVars - nResiduals (negative ≈ over-constrained). */
  dof: number;
  message?: string;
};

export type SolveResult = {
  sketch: SketchDocument;
  status: SolveStatus;
};

export function emptySketch(): SketchDocument {
  return {
    version: 1,
    points: {},
    entities: {},
    constraints: {},
    parameters: {}
  };
}
