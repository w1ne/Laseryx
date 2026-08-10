import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { SketchService } from "../../core/services/SketchService";
import { clientToSvgPoint } from "./preview/designGeometry";
import { useSketchTool, type SketchToolId } from "../sketch/SketchContext";
import { roundMm } from "../../core/util";
import { collectSnapPoints, snapPoint, type SnapPt } from "../../core/snap";

type Pt = { x: number; y: number };

const GRID_MM = 1;
const SNAP_THRESHOLD_MM = 1.5;

/** Default sizes when the user clicks (no drag) — “drop” a figure. */
export const DEFAULT_DROP = {
  rect: { w: 40, h: 30 },
  circleDiameter: 10,
  lineLength: 50,
  slot: { w: 40, h: 8 },
  roundRect: { w: 40, h: 30 }
} as const;

/** Min drag distance (mm) before we treat the gesture as a sized drag vs a click-drop. */
export const MIN_DRAG_MM = 0.5;

export type DrawToolId = Exclude<SketchToolId, "select" | "import" | "dimension">;

/**
 * Resolve final corners/size for a drag. Tiny drags become default-size drops at the start point.
 */
export function resolveDrawGesture(
  tool: DrawToolId,
  a: Pt,
  b: Pt
): { kind: "drag" | "drop"; a: Pt; b: Pt } {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist >= MIN_DRAG_MM) {
    return { kind: "drag", a, b };
  }

  // Click-to-drop: expand from the click point with default size
  if (tool === "circle") {
    const r = DEFAULT_DROP.circleDiameter / 2;
    return { kind: "drop", a, b: { x: a.x + r, y: a.y } };
  }
  if (tool === "line") {
    return { kind: "drop", a, b: { x: a.x + DEFAULT_DROP.lineLength, y: a.y } };
  }
  if (tool === "slot") {
    return {
      kind: "drop",
      a,
      b: { x: a.x + DEFAULT_DROP.slot.w, y: a.y + DEFAULT_DROP.slot.h }
    };
  }
  if (tool === "round-rect") {
    return {
      kind: "drop",
      a,
      b: { x: a.x + DEFAULT_DROP.roundRect.w, y: a.y + DEFAULT_DROP.roundRect.h }
    };
  }
  // rect
  return {
    kind: "drop",
    a,
    b: { x: a.x + DEFAULT_DROP.rect.w, y: a.y + DEFAULT_DROP.rect.h }
  };
}

/**
 * Fusion-style draw: with a create tool active, drag on the bed to define geometry.
 * Click without dragging places a default-size figure (drop).
 */
export function SketchDrawLayer({ enabled }: { enabled: boolean }) {
  const { state, dispatch } = useStore();
  const { tool } = useSketchTool();
  const [ghost, setGhost] = useState<{ a: Pt; b: Pt; snap?: SnapPt | null } | null>(null);
  const startRef = useRef<Pt | null>(null);
  const startSnapRef = useRef<SnapPt | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const toolRef = useRef(tool);
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  const snapTargetsRef = useRef<SnapPt[]>([]);

  const snapTargets = useMemo(
    () => collectSnapPoints(state.document.objects, state.document.sketch),
    [state.document.objects, state.document.sketch]
  );

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);
  useEffect(() => {
    snapTargetsRef.current = snapTargets;
  }, [snapTargets]);

  const applySnap = (p: Pt): { pt: Pt; source?: SnapPt } => {
    const s = snapPoint(p.x, p.y, snapTargetsRef.current, {
      gridMm: GRID_MM,
      thresholdMm: SNAP_THRESHOLD_MM
    });
    return { pt: { x: s.x, y: s.y }, source: s.source };
  };

  // Window-level move/up so pointer capture cannot drop the gesture.
  useEffect(() => {
    if (!enabled) return;
    if (tool === "select" || tool === "import" || tool === "dimension") return;

    const onMove = (e: PointerEvent) => {
      if (!startRef.current || !svgRef.current) return;
      e.preventDefault();
      const raw = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
      if (!raw) return;
      const { pt, source } = applySnap(raw);
      setGhost({ a: startRef.current, b: pt, snap: source ?? null });
    };

    const onUp = (e: PointerEvent) => {
      if (!startRef.current || !svgRef.current) return;
      const a = startRef.current;
      const raw = clientToSvgPoint(svgRef.current, e.clientX, e.clientY) ?? a;
      const { pt, source } = applySnap(raw);
      finishDraw(a, pt, e.shiftKey, startSnapRef.current, source ?? null);
      startRef.current = null;
      startSnapRef.current = null;
      setGhost(null);
    };

    const finishDraw = (
      a: Pt,
      b: Pt,
      shiftOrtho: boolean,
      startSnap: SnapPt | null,
      endSnap: SnapPt | null
    ) => {
      const t = toolRef.current;
      if (t === "select" || t === "import" || t === "dimension") return;
      const resolved = resolveDrawGesture(t as DrawToolId, a, b);
      const { a: p1, b: p2 } = resolved;
      const st = stateRef.current;
      const d = dispatchRef.current;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      if (t === "rect") {
        SketchService.drawRect(st, d, { x: p1.x, y: p1.y, w: dx, h: dy });
      } else if (t === "circle") {
        SketchService.drawCircle(st, d, p1, dist * 2);
      } else if (t === "line") {
        SketchService.drawLine(st, d, p1, p2, {
          ortho: shiftOrtho,
          coincidentStart: startSnap?.sketchPointId,
          coincidentEnd: endSnap?.sketchPointId
        });
      } else if (t === "slot") {
        ObjectService.addSlotBox(st, d, { x: p1.x, y: p1.y, w: dx, h: dy });
      } else if (t === "round-rect") {
        ObjectService.addRoundRectBox(st, d, { x: p1.x, y: p1.y, w: dx, h: dy });
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, tool]);

  if (!enabled || tool === "select" || tool === "import" || tool === "dimension") {
    return null;
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Own the gesture so pan / object select cannot steal the first press
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as SVGElement;
    const svg = el.ownerSVGElement;
    if (!svg) return;
    const raw = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!raw) return;
    const { pt, source } = applySnap(raw);
    svgRef.current = svg;
    startRef.current = pt;
    startSnapRef.current = source ?? null;
    setGhost({ a: pt, b: pt, snap: source ?? null });
    try {
      el.setPointerCapture(e.pointerId);
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
          r={Math.max(r, 0.1)}
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

    const label =
      tool === "circle"
        ? `Ø${roundMm(r * 2)}`
        : tool === "line"
          ? `${roundMm(r)}`
          : `${roundMm(w)} × ${roundMm(h)}`;
    preview = (
      <g pointerEvents="none">
        {preview}
        {g.snap && (
          <circle
            cx={g.b.x}
            cy={g.b.y}
            r={1.2}
            fill="#0ea5e9"
            stroke="#fff"
            strokeWidth={0.4}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <g
          transform={`translate(${(g.a.x + g.b.x) / 2} ${(g.a.y + g.b.y) / 2 - 2}) scale(1 -1)`}
        >
          <text
            x={0}
            y={0}
            fill="#0369a1"
            fontSize="3.5"
            textAnchor="middle"
            style={{ userSelect: "none" }}
          >
            {label} mm
          </text>
        </g>
      </g>
    );
  }

  return (
    <g data-sketch-draw="true">
      <rect
        x={-5000}
        y={-5000}
        width={10000}
        height={10000}
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onPointerDown={onPointerDown}
      />
      {preview}
    </g>
  );
}
