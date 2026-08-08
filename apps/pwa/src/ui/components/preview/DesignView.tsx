import React, { useEffect, useRef } from "react";
import { isConstruction, Obj } from "../../../core/model";
import { expandMacro } from "../../../core/macros/expand";
import { formatMm, roundMm } from "../../../core/util";
import { getObjectSize } from "../../../core/objectEdit";
import { clientToSvgPoint, objectBounds, type BBox } from "./designGeometry";

const r = (n: number) => roundMm(n);

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
  onSelect: (id: string | null) => void;
  onPatchObject: (
    id: string,
    patch: ObjectTransformPatch,
    opts?: { skipHistory?: boolean; commit?: boolean }
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
      mode: "resize";
      id: string;
      corner: "se" | "sw" | "ne" | "nw";
      startWorld: { x: number; y: number };
      startBounds: BBox;
      startObj: Obj;
    };

function pathToPointsAttr(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

const HANDLE = 2.5;

export function DesignView({ objects, selectedId, onSelect, onPatchObject }: DesignViewProps) {
  const dragRef = useRef<DragState | null>(null);
  const objectsRef = useRef(objects);
  const onPatchRef = useRef(onPatchObject);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);
  useEffect(() => {
    onPatchRef.current = onPatchObject;
  }, [onPatchObject]);

  useEffect(() => {
    const applyDrag = (svg: SVGSVGElement, clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const world = clientToSvgPoint(svg, clientX, clientY);
      if (!world) return;

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
      dragRef.current = null;
      // One undo step for the whole drag
      onPatchRef.current("", {}, { commit: true });
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

    onSelect(obj.id);
    dragRef.current = {
      mode: "move",
      id: obj.id,
      startWorld: world,
      originE: obj.transform.e,
      originF: obj.transform.f
    };
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
  const selectedBBox = selected ? objectBounds(selected) : null;

  return (
    <g>
      {objects.map((obj) => {
        const isSelected = obj.id === selectedId;
        const strokeWidth = isSelected ? "2" : "1";
        const cursor = "move";

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
                <polygon
                  points={points}
                  fill="transparent"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <polyline
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={Math.max(2, Number(strokeWidth))}
                  strokeDasharray={dash}
                  vectorEffect="non-scaling-stroke"
                />
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
                  <polygon
                    key={i}
                    points={pts}
                    fill={construct ? "none" : isSelected ? "rgba(59, 130, 246, 0.1)" : "rgba(15, 23, 42, 0.03)"}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dash}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <polyline
                    key={i}
                    points={pts}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dash}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          );
        }

        return null;
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
          {(
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
          {/* Fusion-like dimension readout on selection */}
          {(() => {
            const size = getObjectSize(selected);
            if (!size) return null;
            const midX = (selectedBBox.minX + selectedBBox.maxX) / 2;
            const midY = (selectedBBox.minY + selectedBBox.maxY) / 2;
            const isCircle =
              selected.kind === "macro" &&
              (selected.defId === "mount-hole" || selected.defId === "button");
            const label = isCircle
              ? `Ø${formatMm(size.w)}`
              : `${formatMm(size.w)} × ${formatMm(size.h)}`;
            return (
              <text
                x={midX}
                y={selectedBBox.minY - 2}
                fill="#1d4ed8"
                fontSize="3.2"
                textAnchor="middle"
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {label}
              </text>
            );
          })()}
        </g>
      )}
    </g>
  );
}
