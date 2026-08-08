import React, { useRef, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { clientToSvgPoint } from "./preview/designGeometry";
import { useSketchTool, type SketchToolId } from "../sketch/SketchContext";
import { roundMm } from "../../core/util";

type Pt = { x: number; y: number };

/**
 * Fusion-style draw: with a create tool active, drag on the bed to define geometry.
 */
export function SketchDrawLayer({ enabled }: { enabled: boolean }) {
  const { state, dispatch } = useStore();
  const { tool, setTool } = useSketchTool();
  const [ghost, setGhost] = useState<{ a: Pt; b: Pt } | null>(null);
  const startRef = useRef<Pt | null>(null);

  if (!enabled || tool === "select" || tool === "import") {
    return null;
  }

  const finish = (a: Pt, b: Pt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      setGhost(null);
      startRef.current = null;
      return;
    }

    if (tool === "rect") {
      ObjectService.addRectangleBox(state, dispatch, { x: a.x, y: a.y, w: dx, h: dy });
    } else if (tool === "circle") {
      ObjectService.addCircleCentered(state, dispatch, a, dist * 2);
    } else if (tool === "line") {
      ObjectService.addLineSegment(state, dispatch, a, b);
    } else if (tool === "slot") {
      ObjectService.addSlotBox(state, dispatch, { x: a.x, y: a.y, w: dx, h: dy });
    } else if (tool === "round-rect") {
      ObjectService.addRoundRectBox(state, dispatch, { x: a.x, y: a.y, w: dx, h: dy });
    }

    setGhost(null);
    startRef.current = null;
    setTool("select");
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const p = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!p) return;
    startRef.current = p;
    setGhost({ a: p, b: p });
    svg.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const p = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!p) return;
    setGhost({ a: startRef.current, b: p });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const p = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (p) finish(startRef.current, p);
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const g = ghost;
  let preview: React.ReactNode = null;
  if (g) {
    const x = Math.min(g.a.x, g.b.x);
    const y = Math.min(g.a.y, g.b.y);
    const w = Math.abs(g.b.x - g.a.x);
    const h = Math.abs(g.b.y - g.a.y);
    const r = Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y);

    if (tool === "circle") {
      preview = (
        <circle
          cx={g.a.x}
          cy={g.a.y}
          r={r}
          fill="rgba(14, 165, 233, 0.08)"
          stroke="#0ea5e9"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
    } else if (tool === "line") {
      preview = (
        <line
          x1={g.a.x}
          y1={g.a.y}
          x2={g.b.x}
          y2={g.b.y}
          stroke="#0ea5e9"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
    } else {
      preview = (
        <rect
          x={x}
          y={y}
          width={Math.max(w, 0.1)}
          height={Math.max(h, 0.1)}
          rx={tool === "round-rect" || tool === "slot" ? Math.min(w, h) / 2 : 0}
          fill="rgba(14, 165, 233, 0.08)"
          stroke="#0ea5e9"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
    }

    // dimension readout
    const label =
      tool === "circle"
        ? `Ø${roundMm(r * 2)}`
        : tool === "line"
          ? `${roundMm(r)}`
          : `${roundMm(w)} × ${roundMm(h)}`;
    preview = (
      <g pointerEvents="none">
        {preview}
        <text
          x={(g.a.x + g.b.x) / 2}
          y={(g.a.y + g.b.y) / 2 - 2}
          fill="#0369a1"
          fontSize="3.5"
          textAnchor="middle"
          style={{ userSelect: "none" }}
        >
          {label} mm
        </text>
      </g>
    );
  }

  // Full-bed hit target for drawing (above bed, below/with objects depending on order)
  return (
    <g data-sketch-draw="true">
      <rect
        x={-5000}
        y={-5000}
        width={10000}
        height={10000}
        fill="transparent"
        style={{ cursor: cursorFor(tool) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {preview}
    </g>
  );
}

function cursorFor(tool: SketchToolId): string {
  if (tool === "select") return "default";
  return "crosshair";
}
