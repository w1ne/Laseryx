import React, { useRef } from "react";
import type { SketchDocument } from "../../../core/sketch/types";
import {
  listDimAnnotations,
  signedPerpOffset,
  type DimAnnotation
} from "../../../core/sketch/dimAnnotations";
import { clientToSvgPoint } from "./designGeometry";
import { useSketchTool } from "../../sketch/SketchContext";
import { roundMm } from "../../../core/util";

type Props = {
  sketch: SketchDocument | null | undefined;
  selectedConstraintId?: string | null;
  onSelectConstraint?: (id: string | null) => void;
  /** Live drag of display offset (mm). live=true during pointer move. */
  onMoveOffset?: (id: string, offsetMm: number, live: boolean) => void;
  /** World group is Y-flipped (front-left origin) — keep labels upright. */
  yFlipped?: boolean;
};

const DRAG_PX = 10;
const DBL_MS = 500;

/**
 * Permanent Fusion-style dimension lines.
 * - Click number → select
 * - Double-click number → edit value in place
 * - Drag (past threshold) → move display offset
 * - Delete → remove size
 */
export function DimAnnotationsLayer({
  sketch,
  selectedConstraintId,
  onSelectConstraint,
  onMoveOffset,
  yFlipped = true
}: Props) {
  const { dimInlineEdit, setDimInlineEdit } = useSketchTool();
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const suppressClickRef = useRef(false);

  if (!sketch) return null;
  const anns = listDimAnnotations(sketch);
  if (anns.length === 0) return null;

  const openEdit = (d: DimAnnotation) => {
    lastTapRef.current = null;
    onSelectConstraint?.(d.id);
    setDimInlineEdit({
      constraintId: d.id,
      draft: String(roundMm(d.valueMm)),
      place: { x: d.place.x, y: d.place.y }
    });
  };

  const onPointerDownDim = (e: React.PointerEvent, d: DimAnnotation) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (dimInlineEdit?.constraintId === d.id) return;

    const now = performance.now();
    const last = lastTapRef.current;
    // Double-press the number → edit (do this before any select/drag that could move the label)
    if (last && last.id === d.id && now - last.t < DBL_MS) {
      e.preventDefault();
      openEdit(d);
      return;
    }
    lastTapRef.current = { id: d.id, t: now };
    onSelectConstraint?.(d.id);

    // Potential drag — only after clear movement so a click never nudges the dim
    if (!onMoveOffset) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;

    const startClient = { x: e.clientX, y: e.clientY };
    let dragging = false;

    const offsetFromWorld = (world: { x: number; y: number }) => {
      if (d.kind === "pointLineDistance") {
        const dx = d.b.x - d.a.x;
        const dy = d.b.y - d.a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = -dy / len;
        const uy = dx / len;
        const mx = (d.a.x + d.b.x) / 2;
        const my = (d.a.y + d.b.y) / 2;
        return (world.x - mx) * ux + (world.y - my) * uy;
      }
      if (d.kind === "diameter") {
        return Math.max(2, Math.abs(signedPerpOffset(d.a, d.b, world)));
      }
      let offsetMm = signedPerpOffset(d.a, d.b, world);
      if (Math.abs(offsetMm) < 1.5) offsetMm = offsetMm >= 0 ? 2 : -2;
      return offsetMm;
    };

    const onMove = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y);
      if (!dragging && dist > DRAG_PX) {
        dragging = true;
        suppressClickRef.current = true;
        lastTapRef.current = null; // drag cancels double-tap
      }
      if (!dragging) return;
      const world = clientToSvgPoint(svg, ev.clientX, ev.clientY);
      if (!world) return;
      onMoveOffset(d.id, offsetFromWorld(world), true);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragging) return;
      const world = clientToSvgPoint(svg, ev.clientX, ev.clientY);
      if (world) onMoveOffset(d.id, offsetFromWorld(world), false);
      const swallow = (ce: Event) => {
        ce.stopPropagation();
        ce.preventDefault();
        window.removeEventListener("click", swallow, true);
        // keep suppress briefly so the dblclick of a drag-end is ignored
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      };
      window.addEventListener("click", swallow, true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <g className="dim-annotations" data-testid="dim-annotations">
      {anns.map((d) => {
        const selected = d.id === selectedConstraintId;
        const editingHere = dimInlineEdit?.constraintId === d.id;
        const stroke = selected || editingHere ? "#db2777" : "#7c3aed";
        const fillBox = selected || editingHere ? "#fce7f3" : "#faf5ff";
        const { a2, b2, place, a, b } = d;
        const lx = place.x;
        const ly = place.y;
        const tw = Math.max(14, d.label.length * 2.8);
        const th = 8;
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const textAng = ang > 90 || ang < -90 ? ang + 180 : ang;

        return (
          <g
            key={d.id}
            data-dim-id={d.id}
            data-selected={selected ? "true" : undefined}
            data-editing={editingHere ? "true" : undefined}
            style={{ cursor: editingHere ? "text" : onMoveOffset ? "grab" : "pointer" }}
            onPointerDown={(e) => onPointerDownDim(e, d)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (suppressClickRef.current) return;
              openEdit(d);
            }}
          >
            <line
              x1={a2.x}
              y1={a2.y}
              x2={b2.x}
              y2={b2.y}
              stroke="transparent"
              strokeWidth={14}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="stroke"
            />

            <rect
              x={lx - tw / 2}
              y={ly - th / 2}
              width={tw}
              height={th}
              fill="transparent"
              pointerEvents="all"
              data-dim-label-hit={d.id}
            />

            <line
              x1={a.x}
              y1={a.y}
              x2={a2.x}
              y2={a2.y}
              stroke={stroke}
              strokeWidth={selected || editingHere ? 0.9 : 0.55}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <line
              x1={b.x}
              y1={b.y}
              x2={b2.x}
              y2={b2.y}
              stroke={stroke}
              strokeWidth={selected || editingHere ? 0.9 : 0.55}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <line
              x1={a2.x}
              y1={a2.y}
              x2={b2.x}
              y2={b2.y}
              stroke={stroke}
              strokeWidth={selected || editingHere ? 1.6 : 1.15}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <polygon points={arrow(a2.x, a2.y, b2.x, b2.y, true)} fill={stroke} pointerEvents="none" />
            <polygon points={arrow(a2.x, a2.y, b2.x, b2.y, false)} fill={stroke} pointerEvents="none" />

            {!editingHere && (
              <g
                transform={`translate(${lx} ${ly}) rotate(${textAng})${yFlipped ? " scale(1 -1)" : ""}`}
                pointerEvents="none"
              >
                <rect
                  x={-tw / 2}
                  y={-th / 2 + 0.4}
                  width={tw}
                  height={th - 0.8}
                  rx={0.8}
                  fill={fillBox}
                  stroke={stroke}
                  strokeWidth={selected ? 1.1 : 0.5}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={0}
                  y={1.1}
                  fill={selected ? "#9d174d" : "#6b21a8"}
                  fontSize="3.2"
                  fontWeight="800"
                  textAnchor="middle"
                  style={{ userSelect: "none" }}
                >
                  {d.label}
                </text>
              </g>
            )}
            {!editingHere && (
              <title>{`Dimension ${d.label} mm — double-click to edit · drag to move · Delete to remove`}</title>
            )}
          </g>
        );
      })}
    </g>
  );
}

function arrow(x1: number, y1: number, x2: number, y2: number, atStart: boolean): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const s = 2.2;
  const px = -uy;
  const py = ux;
  const tipX = atStart ? x1 : x2;
  const tipY = atStart ? y1 : y2;
  const bx = tipX + (atStart ? 1 : -1) * ux * s;
  const by = tipY + (atStart ? 1 : -1) * uy * s;
  return `${tipX},${tipY} ${bx + px * s * 0.45},${by + py * s * 0.45} ${bx - px * s * 0.45},${by - py * s * 0.45}`;
}
