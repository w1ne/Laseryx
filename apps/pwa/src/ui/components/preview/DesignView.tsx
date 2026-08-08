import React from "react";
import { Obj } from "../../../core/model";
import { expandMacro } from "../../../core/macros/expand";
import { computeBounds } from "../../../core/geom";

type DesignViewProps = {
    objects: Obj[];
    selectedId?: string;
    onSelect: (id: string) => void;
};

function pathToPointsAttr(points: { x: number; y: number }[]): string {
    return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function DesignView({ objects, selectedId, onSelect }: DesignViewProps) {
    return (
        <g>
            {objects.map(obj => {
                const isSelected = obj.id === selectedId;
                const strokeWidth = isSelected ? "2" : "1";

                if (obj.kind === "image") {
                    return (
                        <image
                            key={obj.id}
                            href={obj.src}
                            x={obj.transform.e}
                            y={obj.transform.f}
                            width={obj.width}
                            height={obj.height}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(obj.id);
                            }}
                            style={{
                                outline: isSelected ? "2px solid #3b82f6" : "none",
                                cursor: "pointer",
                            }}
                        />
                    );
                }

                if (obj.kind === "path") {
                    const t = obj.transform;
                    const points = obj.points.map(p => `${p.x},${p.y}`).join(" ");
                    return (
                        <g
                            key={obj.id}
                            transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(obj.id);
                            }}
                            style={{ cursor: "pointer" }}
                        >
                            {obj.closed ?
                                <polygon
                                    points={points}
                                    fill="none"
                                    stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                    strokeWidth={strokeWidth}
                                    vectorEffect="non-scaling-stroke"
                                /> :
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                    strokeWidth={strokeWidth}
                                    vectorEffect="non-scaling-stroke"
                                />
                            }
                        </g>
                    );
                }

                if (obj.kind === "shape" && obj.shape.type === "rect") {
                    const t = obj.transform;
                    return (
                        <g
                            key={obj.id}
                            transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(obj.id);
                            }}
                            style={{ outline: isSelected ? "2px solid #3b82f6" : "none" }}
                        >
                            <rect
                                width={obj.shape.width}
                                height={obj.shape.height}
                                fill="rgba(59, 130, 246, 0.1)"
                                stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                strokeWidth={strokeWidth}
                                vectorEffect="non-scaling-stroke"
                            />
                        </g>
                    );
                }

                if (obj.kind === "macro") {
                    const expanded = expandMacro(obj);
                    if (!expanded.ok) {
                        const t = obj.transform;
                        return (
                            <g
                                key={obj.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(obj.id);
                                }}
                                style={{ cursor: "pointer" }}
                            >
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
                                <text x={t.e + 4} y={t.f + 16} fill="#ef4444" fontSize="8">
                                    missing def
                                </text>
                            </g>
                        );
                    }

                    const stroke = isSelected ? "#3b82f6" : "#0f172a";
                    const bbox = computeBounds(expanded.paths);
                    return (
                        <g
                            key={obj.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(obj.id);
                            }}
                            style={{ cursor: "pointer" }}
                        >
                            {expanded.paths.map((path, i) => {
                                const pts = pathToPointsAttr(path.points);
                                return path.closed ? (
                                    <polygon
                                        key={i}
                                        points={pts}
                                        fill={isSelected ? "rgba(59, 130, 246, 0.08)" : "none"}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ) : (
                                    <polyline
                                        key={i}
                                        points={pts}
                                        fill="none"
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                );
                            })}
                            {isSelected && (
                                <rect
                                    x={bbox.minX - 1}
                                    y={bbox.minY - 1}
                                    width={Math.max(0, bbox.maxX - bbox.minX + 2)}
                                    height={Math.max(0, bbox.maxY - bbox.minY + 2)}
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth={1}
                                    strokeDasharray="3 2"
                                    vectorEffect="non-scaling-stroke"
                                    pointerEvents="none"
                                />
                            )}
                        </g>
                    );
                }

                return null;
            })}
        </g>
    );
}
