import React from "react";
import { ORIGIN_POINT_ID } from "../../../core/sketch/create";

type Props = {
  /**
   * Width of the visible viewport in mm (the viewBox width). Marker geometry is
   * a fraction of this, so the origin keeps a constant on-screen size at any
   * zoom instead of ballooning in and shrinking out with the bed.
   */
  viewMm?: number;
  /** Axis arm length in mm. Overrides the viewport-derived size. */
  armMm?: number;
  /** When world group is Y-flipped, counter-flip labels so they stay upright. */
  yFlipped?: boolean;
};

/** Fractions of the visible viewport width. At the default 400mm fit-zoom these
 *  reproduce the original fixed sizes, except labels, which were ~7px — too
 *  small to read — and are now ~11px. */
const ARM = 0.07;
const LABEL = 0.0145;
const HALO = 0.0125;
const NODE = 0.0055;
const HEAD = 0.008;

/**
 * Machine origin at (0,0) — X right, Y along +Y (rear when Y-up display).
 * Pickable as a dim reference (Fusion-style origin).
 */
export function OriginAxes({ viewMm = 400, armMm, yFlipped = true }: Props) {
  const a = armMm ?? viewMm * ARM;
  const label = viewMm * LABEL;
  const halo = viewMm * HALO;
  const node = viewMm * NODE;
  const head = viewMm * HEAD;
  const headW = head / 2;
  const upright = (x: number, y: number) =>
    yFlipped ? `translate(${x} ${y}) scale(1 -1)` : `translate(${x} ${y})`;
  return (
    <g className="origin-axes" data-testid="origin-axes" pointerEvents="none">
      {/* Soft halo so origin is obvious on the bed */}
      <circle cx={0} cy={0} r={halo} fill="#0ea5e9" fillOpacity={0.12} />

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
        points={`${a},0 ${a - head},${-headW} ${a - head},${headW}`}
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
        points={`0,${a} ${-headW},${a - head} ${headW},${a - head}`}
        fill="#22c55e"
      />

      {/* Origin node — dim tool can pick this point */}
      <circle
        cx={0}
        cy={0}
        r={node}
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

      <g transform={upright(halo, halo)} pointerEvents="none">
        <text
          x={0}
          y={0}
          fill="#0369a1"
          fontSize={label}
          fontWeight="800"
          style={{ userSelect: "none" }}
        >
          0,0
        </text>
      </g>
      <g transform={upright(a + head / 2, 0)} pointerEvents="none">
        <text x={0} y={label * 0.38} fill="#ef4444" fontSize={label} fontWeight="800">
          X
        </text>
      </g>
      <g transform={upright(0, a + head / 2)} pointerEvents="none">
        <text x={-label * 0.38} y={0} fill="#22c55e" fontSize={label} fontWeight="800">
          Y
        </text>
      </g>
    </g>
  );
}
