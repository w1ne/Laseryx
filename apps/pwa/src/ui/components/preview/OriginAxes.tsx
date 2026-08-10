import React from "react";
import { ORIGIN_POINT_ID } from "../../../core/sketch/create";

type Props = {
  /** Axis arm length in mm */
  armMm?: number;
  /** When world group is Y-flipped, counter-flip labels so they stay upright. */
  yFlipped?: boolean;
};

/**
 * Machine origin at (0,0) — X right, Y along +Y (rear when Y-up display).
 * Pickable as a dim reference (Fusion-style origin).
 */
export function OriginAxes({ armMm = 28, yFlipped = true }: Props) {
  const a = armMm;
  const upright = (x: number, y: number) =>
    yFlipped ? `translate(${x} ${y}) scale(1 -1)` : `translate(${x} ${y})`;
  return (
    <g className="origin-axes" data-testid="origin-axes" pointerEvents="none">
      {/* Soft halo so origin is obvious on the bed */}
      <circle cx={0} cy={0} r={5} fill="#0ea5e9" fillOpacity={0.12} />

      {/* X axis — red */}
      <line
        x1={0}
        y1={0}
        x2={a}
        y2={0}
        stroke="#ef4444"
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${a},0 ${a - 3.2},-1.6 ${a - 3.2},1.6`}
        fill="#ef4444"
      />
      {/* Y axis — green */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={a}
        stroke="#22c55e"
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`0,${a} -1.6,${a - 3.2} 1.6,${a - 3.2}`}
        fill="#22c55e"
      />

      {/* Origin node — dim tool can pick this point */}
      <circle
        cx={0}
        cy={0}
        r={2.2}
        fill="#0ea5e9"
        stroke="#0369a1"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
        pointerEvents="all"
        data-origin-node="true"
        data-point-id={ORIGIN_POINT_ID}
        style={{ cursor: "crosshair" }}
      >
        <title>Origin (0, 0) — dimension to this point</title>
      </circle>

      <g transform={upright(5, 5)} pointerEvents="none">
        <text
          x={0}
          y={0}
          fill="#0369a1"
          fontSize="3.4"
          fontWeight="800"
          style={{ userSelect: "none" }}
        >
          0,0
        </text>
      </g>
      <g transform={upright(a + 2, 0)} pointerEvents="none">
        <text x={0} y={1.2} fill="#ef4444" fontSize="3.2" fontWeight="800">
          X
        </text>
      </g>
      <g transform={upright(0, a + 2)} pointerEvents="none">
        <text x={-1.2} y={0} fill="#22c55e" fontSize="3.2" fontWeight="800">
          Y
        </text>
      </g>
    </g>
  );
}
