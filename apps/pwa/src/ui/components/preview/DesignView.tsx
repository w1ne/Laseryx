import React, { useEffect, useRef } from "react";
import { isConstruction, Obj } from "../../../core/model";
import { expandMacro } from "../../../core/macros/expand";
import { formatMm, roundMm } from "../../../core/util";
import { getObjectSize, padSelectionBounds, pathLength } from "../../../core/objectEdit";
import { clientToSvgPoint, objectBounds, type BBox } from "./designGeometry";
import { entityIdFromObjectId, isSketchObjectId } from "../../../core/sketch/bake";
import type { SketchDocument } from "../../../core/sketch/types";
import {
  entityGlyphPoint,
  listAllConstraints,
  listConstraintsForEntities,
  objectIdsToEntityIds
} from "../../../core/sketch/constraintDisplay";
const r = (n: number) => roundMm(n);

/** Invisible wide stroke so thin laser lines are easy to select (screen px via non-scaling-stroke). */
const HIT_STROKE = 14;

/** Fusion-style construction: orange dashed, not cut. */
function strokeFor(obj: Obj, isSelected: boolean): { stroke: string; dash?: string } {
  if (isConstruction(obj)) {
    return { stroke: isSelected ? "#ea580c" : "#f97316", dash: "4 3" };
  }
  return { stroke: isSelected ? "#3b82f6" : "#0f172a" };
}

export type ObjectTransformPatch = {
  transform?: Obj["transform"];
  shape?: { type: "rect"; width: number; height: number };
  width?: number;
  height?: number;
  params?: Record<string, number | string | boolean>;
};

type DesignViewProps = {
  objects: Obj[];
  selectedId?: string;
  /** Multi-select set (for highlight + constraints). */
  selectedIds?: string[];
  sketch?: SketchDocument | null;
  /** World Y is flipped (front-left origin) — keep size/glyph labels upright. */
  yFlipped?: boolean;
  /** Returns resulting selection ids when known (for group multi-move). */
  onSelect: (id: string | null, opts?: { additive?: boolean }) => string[] | void;
  onPatchObject: (
    id: string,
    patch: ObjectTransformPatch,
    opts?: { skipHistory?: boolean; commit?: boolean }
  ) => void;
  /** Live drag of a sketch point (skipSolve). */
  onMoveSketchPoint?: (pointId: string, x: number, y: number, live: boolean) => void;
  /** Translate whole selection/group by delta (mm). live=true during drag. */
  onTranslateSelection?: (
    dx: number,
    dy: number,
    live: boolean,
    memberIds: string[]
  ) => void;
};

type DragState =
  | {
      mode: "move";
      id: string;
      startWorld: { x: number; y: number };
      originE: number;
      originF: number;
    }
  | {
      mode: "multi-move";
      startWorld: { x: number; y: number };
      memberIds: string[];
    }
  | {
      mode: "resize";
      id: string;
      corner: "se" | "sw" | "ne" | "nw";
      startWorld: { x: number; y: number };
      startBounds: BBox;
      startObj: Obj;
    }
  | {
      mode: "sketch-point";
      pointId: string;
      objectId: string;
    };

function pathToPointsAttr(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

const HANDLE = 2.5;
const END_HANDLE = 2.2;

export function DesignView({
  objects,
  selectedId,
  selectedIds,
  sketch,
  yFlipped = true,
  onSelect,
  onPatchObject,
  onMoveSketchPoint,
  onTranslateSelection
}: DesignViewProps) {
  const dragRef = useRef<DragState | null>(null);
  const objectsRef = useRef(objects);
  const onPatchRef = useRef(onPatchObject);
  const onMoveSketchPointRef = useRef(onMoveSketchPoint);
  const onTranslateSelectionRef = useRef(onTranslateSelection);
  const selSet = new Set(selectedIds?.length ? selectedIds : selectedId ? [selectedId] : []);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);
  useEffect(() => {
    onPatchRef.current = onPatchObject;
  }, [onPatchObject]);
  useEffect(() => {
    onMoveSketchPointRef.current = onMoveSketchPoint;
  }, [onMoveSketchPoint]);
  useEffect(() => {
    onTranslateSelectionRef.current = onTranslateSelection;
  }, [onTranslateSelection]);

  useEffect(() => {
    const applyDrag = (svg: SVGSVGElement, clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const world = clientToSvgPoint(svg, clientX, clientY);
      if (!world) return;

      if (drag.mode === "sketch-point") {
        onMoveSketchPointRef.current?.(drag.pointId, r(world.x), r(world.y), true);
        return;
      }

      if (drag.mode === "multi-move") {
        // Absolute delta from drag start — parent applies against a snapshot
        const dx = r(world.x - drag.startWorld.x);
        const dy = r(world.y - drag.startWorld.y);
        onTranslateSelectionRef.current?.(dx, dy, true, drag.memberIds);
        return;
      }

      if (drag.mode === "move") {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        const obj = objectsRef.current.find((o) => o.id === drag.id);
        if (!obj) return;
        onPatchRef.current(
          drag.id,
          {
            transform: {
              ...obj.transform,
              e: r(drag.originE + dx),
              f: r(drag.originF + dy)
            }
          },
          { skipHistory: true }
        );
        return;
      }

      const { startBounds: b, startObj, corner } = drag;
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;

      let minX = b.minX;
      let minY = b.minY;
      let maxX = b.maxX;
      let maxY = b.maxY;

      if (corner.includes("e")) maxX = Math.max(minX + 1, b.maxX + dx);
      if (corner.includes("w")) minX = Math.min(maxX - 1, b.minX + dx);
      if (corner.includes("s")) maxY = Math.max(minY + 1, b.maxY + dy);
      if (corner.includes("n")) minY = Math.min(maxY - 1, b.minY + dy);

      const newW = r(Math.max(0.1, maxX - minX));
      const newH = r(Math.max(0.1, maxY - minY));
      minX = r(minX);
      minY = r(minY);
      const live = { skipHistory: true as const };

      if (startObj.kind === "shape" && startObj.shape.type === "rect") {
        onPatchRef.current(
          drag.id,
          {
            transform: { ...startObj.transform, e: minX, f: minY },
            shape: { type: "rect", width: newW, height: newH }
          },
          live
        );
        return;
      }

      if (startObj.kind === "image") {
        onPatchRef.current(
          drag.id,
          {
            transform: { ...startObj.transform, e: minX, f: minY },
            width: newW,
            height: newH
          },
          live
        );
        return;
      }

      if (startObj.kind === "macro") {
        if (startObj.defId === "mount-hole" || startObj.defId === "button") {
          const d = r(Math.max(0.5, Math.min(newW, newH)));
          onPatchRef.current(
            drag.id,
            {
              transform: {
                ...startObj.transform,
                e: r(minX + d / 2),
                f: r(minY + d / 2)
              },
              params: { ...startObj.params, diameterMm: d }
            },
            live
          );
          return;
        }
        if (startObj.defId === "slot") {
          onPatchRef.current(
            drag.id,
            {
              transform: { ...startObj.transform, e: minX, f: minY },
              params: { ...startObj.params, lengthMm: newW, widthMm: newH }
            },
            live
          );
          return;
        }
        if (startObj.defId === "round-rect") {
          const rad = Number(startObj.params.radiusMm ?? 0);
          onPatchRef.current(
            drag.id,
            {
              transform: { ...startObj.transform, e: minX, f: minY },
              params: {
                ...startObj.params,
                widthMm: newW,
                heightMm: newH,
                radiusMm: r(Math.min(rad, newW / 2, newH / 2))
              }
            },
            live
          );
          return;
        }

        onPatchRef.current(
          drag.id,
          {
            transform: {
              ...startObj.transform,
              e: r(startObj.transform.e + (minX - b.minX)),
              f: r(startObj.transform.f + (minY - b.minY))
            }
          },
          live
        );
        return;
      }

      if (startObj.kind === "path") {
        onPatchRef.current(
          drag.id,
          {
            transform: {
              ...startObj.transform,
              e: r(startObj.transform.e + (minX - b.minX)),
              f: r(startObj.transform.f + (minY - b.minY))
            }
          },
          live
        );
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const svg = e.currentTarget as SVGSVGElement;
      applyDrag(svg, e.clientX, e.clientY);
    };

    const onUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      const svg = e.currentTarget as SVGSVGElement;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    // Attach to any parent svg once we have a root from first interaction via document
    const onDocMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const svg = document.querySelector(".preview-svg") as SVGSVGElement | null;
      if (!svg) return;
      applyDrag(svg, e.clientX, e.clientY);
    };
    const onDocUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag.mode === "sketch-point") {
        const svg = document.querySelector(".preview-svg") as SVGSVGElement | null;
        if (svg) {
          const world = clientToSvgPoint(svg, e.clientX, e.clientY);
          if (world) {
            onMoveSketchPointRef.current?.(drag.pointId, r(world.x), r(world.y), false);
          }
        }
      } else if (drag.mode === "multi-move") {
        // Commit one history step for the group drag (zero delta finalize)
        onTranslateSelectionRef.current?.(0, 0, false, drag.memberIds);
        onPatchRef.current("", {}, { commit: true });
      } else {
        // One undo step for the whole free-object drag
        onPatchRef.current("", {}, { commit: true });
      }
      const svg = document.querySelector(".preview-svg") as SVGSVGElement | null;
      if (svg) {
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener("pointermove", onDocMove);
    window.addEventListener("pointerup", onDocUp);
    window.addEventListener("pointercancel", onDocUp);
    return () => {
      window.removeEventListener("pointermove", onDocMove);
      window.removeEventListener("pointerup", onDocUp);
      window.removeEventListener("pointercancel", onDocUp);
      // silence unused if tree shakes
      void onMove;
      void onUp;
    };
  }, []);

  const beginMove = (e: React.PointerEvent, obj: Obj) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (!world) return;

    const result = onSelect(obj.id, { additive: e.shiftKey });
    const nextIds =
      result && result.length > 0
        ? result
        : e.shiftKey
          ? selSet.has(obj.id)
            ? [...selSet].filter((id) => id !== obj.id)
            : [...selSet, obj.id]
          : selSet.has(obj.id) && selSet.size > 1
            ? [...selSet]
            : [obj.id];

    const multi = nextIds.length > 1;
    if (multi && onTranslateSelection) {
      dragRef.current = {
        mode: "multi-move",
        startWorld: world,
        memberIds: nextIds
      };
      svg.setPointerCapture(e.pointerId);
      return;
    }

    // Single sketch entity: endpoint handles only (unless part of multi above)
    if (isSketchObjectId(obj.id)) {
      return;
    }

    dragRef.current = {
      mode: "move",
      id: obj.id,
      startWorld: world,
      originE: obj.transform.e,
      originF: obj.transform.f
    };
    svg.setPointerCapture(e.pointerId);
  };

  const beginSketchPoint = (
    e: React.PointerEvent,
    pointId: string,
    objectId: string
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    onSelect(objectId);
    dragRef.current = { mode: "sketch-point", pointId, objectId };
    svg.setPointerCapture(e.pointerId);
  };

  const beginResize = (
    e: React.PointerEvent,
    obj: Obj,
    corner: "se" | "sw" | "ne" | "nw"
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const world = clientToSvgPoint(svg, e.clientX, e.clientY);
    const bounds = objectBounds(obj);
    if (!world || !bounds) return;

    onSelect(obj.id);
    dragRef.current = {
      mode: "resize",
      id: obj.id,
      corner,
      startWorld: world,
      startBounds: bounds,
      startObj: structuredClone(obj)
    };
    svg.setPointerCapture(e.pointerId);
  };

  const selected = objects.find((o) => o.id === selectedId);
  const rawSelectedBBox = selected ? objectBounds(selected) : null;
  // Lines often have zero height/width — pad so chrome + handles remain usable
  const selectedBBox = rawSelectedBBox ? padSelectionBounds(rawSelectedBBox) : null;

  return (
    <g>
      {objects.map((obj) => {
        const isSelected = selSet.has(obj.id);
        const strokeWidth = isSelected ? "2" : "1";
        const cursor = isSketchObjectId(obj.id) ? "pointer" : "move";

        if (obj.kind === "image") {
          return (
            <image
              key={obj.id}
              href={obj.src}
              x={obj.transform.e}
              y={obj.transform.f}
              width={obj.width}
              height={obj.height}
              onPointerDown={(e) => beginMove(e, obj)}
              style={{
                outline: isSelected ? "2px solid #3b82f6" : "none",
                cursor
              }}
            />
          );
        }

        if (obj.kind === "path") {
          const t = obj.transform;
          const points = obj.points.map((p) => `${p.x},${p.y}`).join(" ");
          const { stroke, dash } = strokeFor(obj, isSelected);
          return (
            <g
              key={obj.id}
              transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
              onPointerDown={(e) => beginMove(e, obj)}
              style={{ cursor }}
            >
              {obj.closed ? (
                <>
                  <polygon
                    points={points}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={HIT_STROKE}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="all"
                  />
                  <polygon
                    points={points}
                    fill="transparent"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dash}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                </>
              ) : (
                <>
                  {/* Fat hit strip — lines are otherwise 1–2 screen px and nearly unselectable */}
                  <polyline
                    points={points}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HIT_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="stroke"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray={dash}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                </>
              )}
            </g>
          );
        }

        if (obj.kind === "shape" && obj.shape.type === "rect") {
          const t = obj.transform;
          const { stroke, dash } = strokeFor(obj, isSelected);
          const construct = isConstruction(obj);
          return (
            <g
              key={obj.id}
              transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
              onPointerDown={(e) => beginMove(e, obj)}
              style={{ cursor }}
            >
              <rect
                width={obj.shape.width}
                height={obj.shape.height}
                fill={construct ? "none" : isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(15, 23, 42, 0.04)"}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        }

        if (obj.kind === "macro") {
          const expanded = expandMacro(obj);
          const { stroke, dash } = strokeFor(obj, isSelected);
          const construct = isConstruction(obj);
          if (!expanded.ok) {
            const t = obj.transform;
            return (
              <g key={obj.id} onPointerDown={(e) => beginMove(e, obj)} style={{ cursor }}>
                <rect
                  x={t.e}
                  y={t.f}
                  width={40}
                  height={30}
                  fill="rgba(239, 68, 68, 0.1)"
                  stroke="#ef4444"
                  strokeWidth={strokeWidth}
                  strokeDasharray="4 2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          }

          return (
            <g key={obj.id} onPointerDown={(e) => beginMove(e, obj)} style={{ cursor }}>
              {expanded.paths.map((path, i) => {
                const pts = pathToPointsAttr(path.points);
                return path.closed ? (
                  <g key={i}>
                    <polygon
                      points={pts}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={HIT_STROKE}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="all"
                    />
                    <polygon
                      points={pts}
                      fill={construct ? "none" : isSelected ? "rgba(59, 130, 246, 0.1)" : "rgba(15, 23, 42, 0.03)"}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dash}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  </g>
                ) : (
                  <g key={i}>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={HIT_STROKE}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="stroke"
                    />
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dash}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
            </g>
          );
        }

        return null;
      })}

      {/* Multi-select secondary highlights */}
      {Array.from(selSet)
        .filter((id) => id !== selectedId)
        .map((id) => {
          const obj = objects.find((o) => o.id === id);
          const b = obj ? objectBounds(obj) : null;
          if (!b) return null;
          const pb = padSelectionBounds(b);
          return (
            <rect
              key={`ms-${id}`}
              x={pb.minX}
              y={pb.minY}
              width={Math.max(0, pb.maxX - pb.minX)}
              height={Math.max(0, pb.maxY - pb.minY)}
              fill="none"
              stroke="#93c5fd"
              strokeWidth={1}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}

      {selected && selectedBBox && (
        <g className="selection-chrome">
          <rect
            x={selectedBBox.minX}
            y={selectedBBox.minY}
            width={Math.max(0, selectedBBox.maxX - selectedBBox.minX)}
            height={Math.max(0, selectedBBox.maxY - selectedBBox.minY)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {/* Free objects: corner resize. Sketch lines: endpoint drag instead. */}
          {!isSketchObjectId(selected.id) &&
            (
              [
                ["nw", selectedBBox.minX, selectedBBox.minY],
                ["ne", selectedBBox.maxX, selectedBBox.minY],
                ["sw", selectedBBox.minX, selectedBBox.maxY],
                ["se", selectedBBox.maxX, selectedBBox.maxY]
              ] as const
            ).map(([corner, x, y]) => (
              <rect
                key={corner}
                x={x - HANDLE}
                y={y - HANDLE}
                width={HANDLE * 2}
                height={HANDLE * 2}
                fill="#fff"
                stroke="#3b82f6"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                style={{
                  cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize"
                }}
                onPointerDown={(e) => beginResize(e, selected, corner)}
              />
            ))}
          {isSketchObjectId(selected.id) &&
            sketch &&
            (() => {
              const eid = entityIdFromObjectId(selected.id);
              if (!eid) return null;
              const ent = sketch.entities[eid];
              if (!ent) return null;
              const pts: { id: string; x: number; y: number }[] = [];
              if (ent.kind === "line") {
                const p1 = sketch.points[ent.p1];
                const p2 = sketch.points[ent.p2];
                if (p1) pts.push({ id: p1.id, x: p1.x, y: p1.y });
                if (p2) pts.push({ id: p2.id, x: p2.x, y: p2.y });
              } else if (ent.kind === "circle") {
                const c = sketch.points[ent.center];
                if (c) pts.push({ id: c.id, x: c.x, y: c.y });
              }
              return pts.map((p) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={END_HANDLE}
                  fill="#fff"
                  stroke="#2563eb"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "crosshair" }}
                  onPointerDown={(e) => beginSketchPoint(e, p.id, selected.id)}
                />
              ));
            })()}
          {/* Fusion-like dimension readout on selection */}
          {(() => {
            const midX = (selectedBBox.minX + selectedBBox.maxX) / 2;
            const isCircle =
              selected.kind === "macro" &&
              (selected.defId === "mount-hole" || selected.defId === "button");
            const sketchCircle =
              selected.kind === "path" && selected.closed && isSketchObjectId(selected.id);
            const lineLen =
              selected.kind === "path" && !selected.closed ? pathLength(selected) : null;
            let label: string | null = null;
            if (isCircle || sketchCircle) {
              const size = getObjectSize(selected);
              if (size) label = `Ø${formatMm(size.w)}`;
            } else if (lineLen != null) {
              label = `${formatMm(lineLen)} mm`;
            } else {
              const size = getObjectSize(selected);
              if (size) label = `${formatMm(size.w)} × ${formatMm(size.h)}`;
            }
            if (!label) return null;
            const lx = midX;
            const ly = selectedBBox.minY - 2;
            return (
              <g
                transform={
                  yFlipped ? `translate(${lx} ${ly}) scale(1 -1)` : `translate(${lx} ${ly})`
                }
                pointerEvents="none"
              >
                <text
                  x={0}
                  y={0}
                  fill="#1d4ed8"
                  fontSize="3.2"
                  textAnchor="middle"
                  style={{ userSelect: "none" }}
                >
                  {label}
                </text>
              </g>
            );
          })()}
        </g>
      )}

      {/* Geometric constraint glyphs only (H, V, ∥…) — not dimensions */}
      {sketch &&
        (() => {
          const eids = objectIdsToEntityIds([...selSet]);
          const list = (
            eids.length > 0
              ? listConstraintsForEntities(sketch, eids)
              : listAllConstraints(sketch)
          ).filter(
            (c) =>
              c.type !== "length" &&
              c.type !== "distance" &&
              c.type !== "pointLineDistance" &&
              c.type !== "diameter" &&
              c.type !== "radius"
          );
          const toShow = eids.length > 0 ? list : list.slice(0, 40);
          const offsets = new Map<string, number>();
          return (
            <g className="constraint-glyphs" pointerEvents="none">
              {toShow.map((c) => {
                const eid = c.entityIds[0];
                if (!eid) return null;
                const pt = entityGlyphPoint(sketch, eid);
                if (!pt) return null;
                const n = offsets.get(eid) ?? 0;
                offsets.set(eid, n + 1);
                const x = pt.x + n * 3.2;
                const y = pt.y - 2.5;
                return (
                  <g
                    key={c.id}
                    transform={
                      yFlipped ? `translate(${x},${y}) scale(1 -1)` : `translate(${x},${y})`
                    }
                  >
                    <title>{c.label}</title>
                    <rect
                      x={-1.6}
                      y={-2.4}
                      width={3.2 + (c.glyph.length > 1 ? 1.5 : 0)}
                      height={3.2}
                      rx={0.5}
                      fill="#0ea5e9"
                      opacity={0.92}
                    />
                    <text
                      x={0}
                      y={0.2}
                      fill="#fff"
                      fontSize="2.4"
                      fontWeight="700"
                      textAnchor="middle"
                      style={{ userSelect: "none" }}
                    >
                      {c.glyph}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
    </g>
  );
}
