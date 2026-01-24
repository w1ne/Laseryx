import React from "react";
import { DocumentObject } from "../../../core/model";

type DesignViewProps = {
    objects: DocumentObject[];
    selectedId?: string;
    onSelect: (id: string) => void;
};

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
                return null;
            })}
        </g>
    );
}
