import React, { useEffect } from "react";
import { useStore } from "../../core/state/store";
import { useSketchTool } from "../sketch/SketchContext";
import { clientToSvgPoint } from "./preview/designGeometry";
import type { DimPick } from "../../core/sketch/dimension";
import { createDimensionBetween, measurePick } from "../../core/sketch/dimension";
import { highlightGeom, pickDimAtClient } from "../../core/sketch/dimensionHit";
import { dimLineFromOffset, signedPerpOffset } from "../../core/sketch/dimAnnotations";
import { formatMm } from "../../core/util";
import type { SketchDocument } from "../../core/sketch/types";
import { entityIdFromObjectId, isSketchObjectId } from "../../core/sketch/bake";

/**
 * Fusion Sketch Dimension (D):
 *
 * Click a **line on a rectangle** → dimension line appears and follows the mouse
 * Click to place → type value in HUD → Enter
 *
 * Or: click point, then another point/line → distance / point–line dim
 */
export function DimensionPickLayer({ enabled }: { enabled: boolean }) {
  const { state } = useStore();
  const { tool, dimSession, setDimSession, resetDimSession } = useSketchTool();
  const sketch = state.document.sketch;

  // Fusion: if you already selected a line then hit Dim, seed that line
  useEffect(() => {
    if (!enabled || tool !== "dimension" || !sketch) return;
    if (dimSession.phase !== "idle") return;

    const ids =
      state.selectedObjectIds.length > 0
        ? state.selectedObjectIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : [];
    const sketchIds = ids.filter(isSketchObjectId);
    if (sketchIds.length === 0) return;

    // Prefer a single line edge (rectangle member is one sketch line)
    for (const oid of sketchIds) {
      const eid = entityIdFromObjectId(oid);
      if (!eid) continue;
      const e = sketch.entities[eid];
      if (e?.kind === "line") {
        const draft = createDimensionBetween(sketch, { kind: "line", lineId: eid }, null);
        if (!draft.ok) continue;
        const mid = measurePick(sketch, { kind: "line", lineId: eid }) ?? { x: 0, y: 0 };
        setDimSession({
          phase: "place",
          first: { kind: "line", lineId: eid },
          second: null,
          measuredMm: draft.measuredMm,
          cursor: { x: mid.x, y: mid.y - 12 }
        });
        return;
      }
      if (e?.kind === "circle") {
        const draft = createDimensionBetween(sketch, { kind: "circle", circleId: eid }, null);
        if (!draft.ok) continue;
        const mid = measurePick(sketch, { kind: "circle", circleId: eid }) ?? { x: 0, y: 0 };
        setDimSession({
          phase: "place",
          first: { kind: "circle", circleId: eid },
          second: null,
          measuredMm: draft.measuredMm,
          cursor: { x: mid.x, y: mid.y - 12 }
        });
        return;
      }
    }
  }, [enabled, tool, sketch, state.selectedObjectId, state.selectedObjectIds, dimSession.phase, setDimSession]);

  if (!enabled || tool !== "dimension" || !sketch) return null;

  const picksEqual = (a: DimPick, b: DimPick) =>
    a.kind === b.kind &&
    ((a.kind === "point" && b.kind === "point" && a.pointId === b.pointId) ||
      (a.kind === "line" && b.kind === "line" && a.lineId === b.lineId) ||
      (a.kind === "circle" && b.kind === "circle" && a.circleId === b.circleId));

  const startPlace = (
    first: DimPick,
    second: DimPick | null,
    measuredMm: number,
    cursor: { x: number; y: number }
  ) => {
    setDimSession({ phase: "place", first, second, measuredMm, cursor });
  };

  const openHud = (world: { x: number; y: number }) => {
    if (dimSession.phase !== "place") return;
    setDimSession({
      phase: "edit",
      first: dimSession.first,
      second: dimSession.second,
      measuredMm: dimSession.measuredMm,
      place: world,
      draft: String(Math.round(dimSession.measuredMm * 10) / 10)
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!world) return;

    if (dimSession.phase === "edit") return;

    // Fusion: while placing, click = place dim + type value
    if (dimSession.phase === "place") {
      const pick = pickDimAtClient(sketch, svg, e.clientX, e.clientY);
      // If user clicks a *different* entity while placing a single-entity length,
      // treat as second reference (distance) instead of place.
      if (
        pick &&
        dimSession.second == null &&
        (dimSession.first.kind === "line" || dimSession.first.kind === "point") &&
        !picksEqual(dimSession.first, pick)
      ) {
        const draft = createDimensionBetween(sketch, dimSession.first, pick);
        if (draft.ok) {
          startPlace(dimSession.first, pick, draft.measuredMm, world);
          return;
        }
      }
      openHud(world);
      return;
    }

    const pick = pickDimAtClient(sketch, svg, e.clientX, e.clientY);

    if (dimSession.phase === "idle") {
      if (!pick) return;
      // Fusion: click a line → dimension appears and follows mouse immediately
      if (pick.kind === "line" || pick.kind === "circle") {
        const draft = createDimensionBetween(sketch, pick, null);
        if (!draft.ok) return;
        startPlace(pick, null, draft.measuredMm, world);
        return;
      }
      // Point needs a second reference
      setDimSession({ phase: "picked1", first: pick });
      return;
    }

    if (dimSession.phase === "picked1") {
      const first = dimSession.first;
      if (!pick) {
        // empty: cancel
        resetDimSession();
        return;
      }
      if (picksEqual(first, pick)) return;
      const draft = createDimensionBetween(sketch, first, pick);
      if (!draft.ok) {
        setDimSession({ phase: "picked1", first: pick });
        return;
      }
      startPlace(first, pick, draft.measuredMm, world);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dimSession.phase !== "place") return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!world) return;
    setDimSession({ ...dimSession, cursor: world });
  };

  const statusText =
    dimSession.phase === "idle"
      ? "Dimension: click a line (or point). Dim line will follow the mouse."
      : dimSession.phase === "picked1"
        ? "Click second point or line"
        : dimSession.phase === "place"
          ? "Move to position the dimension, then click — then type the value on the dim"
          : "Type value on the dimension · Enter";

  const firstHl =
    dimSession.phase !== "idle" ? highlightGeom(sketch, dimSession.first) : null;
  const secondHl =
    (dimSession.phase === "place" || dimSession.phase === "edit") && dimSession.second
      ? highlightGeom(sketch, dimSession.second)
      : null;

  const preview =
    dimSession.phase === "place" || dimSession.phase === "edit"
      ? {
          first: dimSession.first,
          second: dimSession.second,
          place: dimSession.phase === "place" ? dimSession.cursor : dimSession.place,
          value: dimSession.measuredMm,
          // During value entry the HTML in-place editor is the label
          hideLabel: dimSession.phase === "edit"
        }
      : null;

  return (
    <g data-dimension-pick="true" data-testid="dimension-pick-layer">
      <rect
        x={-8000}
        y={-8000}
        width={16000}
        height={16000}
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      />

      {Object.values(sketch.points).map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={1.4}
          fill="#a855f7"
          fillOpacity={0.45}
          stroke="#6b21a8"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}

      {firstHl && <Highlight g={firstHl} />}
      {secondHl && <Highlight g={secondHl} color="#c026d3" />}

      {preview && (
        <DimPreview
          sketch={sketch}
          first={preview.first}
          second={preview.second}
          place={preview.place}
          value={preview.value}
          hideLabel={preview.hideLabel}
        />
      )}

      {/* Status in machine space near origin corner (+Y is up on screen when flipped) */}
      <g transform="translate(6 14) scale(1 -1)" pointerEvents="none">
        <text
          x={0}
          y={0}
          fill="#6b21a8"
          fontSize="3.8"
          fontWeight="700"
          style={{ userSelect: "none" }}
        >
          {statusText}
        </text>
      </g>
    </g>
  );
}

function Highlight({
  g,
  color = "#7c3aed"
}: {
  g: NonNullable<ReturnType<typeof highlightGeom>>;
  color?: string;
}) {
  if (g.kind === "point") {
    return (
      <circle
        cx={g.x}
        cy={g.y}
        r={2.4}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
  }
  if (g.kind === "line") {
    return (
      <line
        x1={g.x1}
        y1={g.y1}
        x2={g.x2}
        y2={g.y2}
        stroke={color}
        strokeWidth={2.4}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
  }
  return (
    <circle
      cx={g.cx}
      cy={g.cy}
      r={g.r}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

/** Fusion-like extension lines + dimension line + arrows + value (always parallel to anchors). */
function DimPreview({
  sketch,
  first,
  second,
  place,
  value,
  hideLabel
}: {
  sketch: SketchDocument;
  first: DimPick;
  second: DimPick | null;
  place: { x: number; y: number };
  value: number;
  hideLabel?: boolean;
}) {
  const anchors = dimAnchors(sketch, first, second);
  if (!anchors) return null;
  const { a, b } = anchors;

  // Pure perpendicular offset only — dim line stays parallel to geometry (Fusion)
  let offsetMm = signedPerpOffset(a, b, place);
  if (Math.abs(offsetMm) < 2) offsetMm = offsetMm >= 0 ? 10 : -10;
  const { a2, b2, place: labelAt } = dimLineFromOffset(a, b, offsetMm);
  const label = second == null && first.kind === "circle" ? `Ø${formatMm(value)}` : formatMm(value);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  // Keep text readable (never upside-down)
  const textAng = ang > 90 || ang < -90 ? ang + 180 : ang;
  const tw = Math.max(14, label.length * 2.6);

  return (
    <g pointerEvents="none" data-testid="dim-preview">
      {/* extension lines — always perpendicular to measured segment */}
      <line
        x1={a.x}
        y1={a.y}
        x2={a2.x}
        y2={a2.y}
        stroke="#7c3aed"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={b.x}
        y1={b.y}
        x2={b2.x}
        y2={b2.y}
        stroke="#7c3aed"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {/* dimension line — parallel to a→b */}
      <line
        x1={a2.x}
        y1={a2.y}
        x2={b2.x}
        y2={b2.y}
        stroke="#7c3aed"
        strokeWidth={1.4}
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={arrowHead(a2.x, a2.y, b2.x, b2.y, true)} fill="#7c3aed" />
      <polygon points={arrowHead(a2.x, a2.y, b2.x, b2.y, false)} fill="#7c3aed" />
      {/* Label omitted while in-place HTML editor is open on this spot */}
      {!hideLabel && (
        <g transform={`translate(${labelAt.x} ${labelAt.y}) rotate(${textAng}) scale(1 -1)`}>
          <rect
            x={-tw / 2}
            y={-3.2}
            width={tw}
            height={5.8}
            rx={1}
            fill="#fff"
            stroke="#7c3aed"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={0}
            y={0.9}
            fill="#6b21a8"
            fontSize="3.8"
            fontWeight="800"
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

function dimAnchors(
  sketch: SketchDocument,
  first: DimPick,
  second: DimPick | null
): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  if (!second) {
    if (first.kind === "line") {
      const line = sketch.entities[first.lineId];
      if (!line || line.kind !== "line") return null;
      const p1 = sketch.points[line.p1];
      const p2 = sketch.points[line.p2];
      if (!p1 || !p2) return null;
      return { a: p1, b: p2 };
    }
    if (first.kind === "circle") {
      const e = sketch.entities[first.circleId];
      if (!e || e.kind !== "circle") return null;
      const c = sketch.points[e.center];
      if (!c) return null;
      return {
        a: { x: c.x - e.r, y: c.y },
        b: { x: c.x + e.r, y: c.y }
      };
    }
    return null;
  }
  const a = measurePick(sketch, first);
  const b = measurePick(sketch, second);
  if (!a || !b) return null;
  // point–line: project
  if (first.kind === "point" && second.kind === "line") {
    const line = sketch.entities[second.lineId];
    if (line?.kind === "line") {
      const p1 = sketch.points[line.p1];
      const p2 = sketch.points[line.p2];
      if (p1 && p2) {
        const abx = p2.x - p1.x;
        const aby = p2.y - p1.y;
        const len2 = abx * abx + aby * aby || 1;
        const t = ((a.x - p1.x) * abx + (a.y - p1.y) * aby) / len2;
        return { a, b: { x: p1.x + t * abx, y: p1.y + t * aby } };
      }
    }
  }
  if (first.kind === "line" && second.kind === "point") {
    return dimAnchors(sketch, second, first);
  }
  return { a, b };
}

function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  atStart: boolean
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const s = 2.4;
  const px = -uy;
  const py = ux;
  const tipX = atStart ? x1 : x2;
  const tipY = atStart ? y1 : y2;
  const bx = tipX + (atStart ? 1 : -1) * ux * s;
  const by = tipY + (atStart ? 1 : -1) * uy * s;
  return `${tipX},${tipY} ${bx + px * s * 0.45},${by + py * s * 0.45} ${bx - px * s * 0.45},${by - py * s * 0.45}`;
}
