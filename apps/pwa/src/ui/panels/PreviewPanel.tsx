import React from "react";
import { useStore } from "../../core/state/store";
import { MachineStatus } from "../../core/state/types";

type PreviewPanelProps = {
    className?: string;
    showMachineHead?: boolean;
    machineStatus?: MachineStatus;
};

export function PreviewPanel({ className, showMachineHead, machineStatus }: PreviewPanelProps) {
    const { state, dispatch } = useStore();
    const { document: doc, machineProfile, selectedObjectId } = state;

    return (
        <div className={`panel panel--preview ${className || ""}`}>
            <div className="preview-container">
                <svg
                    className="preview-svg"
                    viewBox={`0 0 ${machineProfile.bedMm.w} ${machineProfile.bedMm.h}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                        </pattern>
                    </defs>

                    {/* Bed Background */}
                    <rect width="100%" height="100%" fill="#f8fafc" />
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Machine Origin Indicator (Bottom Left) */}
                    <path d="M 0 20 L 0 0 L 20 0" fill="none" stroke="#cbd5e1" strokeWidth="2" />

                    {/* Objects */}
                    {doc.objects.map(obj => {
                        const isSelected = obj.id === selectedObjectId;

                        if (obj.kind === "image") {
                            return (
                                <image
                                    key={obj.id}
                                    href={obj.src}
                                    x={obj.transform.e}
                                    y={obj.transform.f}
                                    width={obj.width}
                                    height={obj.height}
                                    onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                    style={{
                                        outline: isSelected ? "2px solid #3b82f6" : "none",
                                        cursor: "pointer"
                                    }}
                                />
                            );
                        }

                        if (obj.kind === "path") {
                            const t = obj.transform;
                            // Note: This raw point rendering is simple but might not handle curves if we had them. 
                            // Since we only have polyline/polygon from import, it's fine.
                            const points = obj.points.map(p => `${p.x},${p.y}`).join(" ");
                            return (
                                <g
                                    key={obj.id}
                                    transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
                                    onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                    style={{ cursor: "pointer" }}
                                >
                                    {obj.closed ?
                                        <polygon
                                            points={points}
                                            fill="none"
                                            stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                            strokeWidth={isSelected ? "2" : "1"}
                                        /> :
                                        <polyline
                                            points={points}
                                            fill="none"
                                            stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                            strokeWidth={isSelected ? "2" : "1"}
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
                                    onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                    style={{ outline: isSelected ? "2px solid #3b82f6" : "none" }}
                                >
                                    <rect
                                        width={obj.shape.width}
                                        height={obj.shape.height}
                                        fill="rgba(59, 130, 246, 0.1)"
                                        stroke={isSelected ? "#3b82f6" : "#0f172a"}
                                        strokeWidth={isSelected ? "2" : "1"}
                                    />
                                </g>
                            );
                        }
                        return null;
                    })}

                    {/* Machine Head Visualization */}
                    {showMachineHead && machineStatus && (
                        <g transform={`translate(${machineStatus.wpos.x}, ${machineStatus.wpos.y})`}>
                            {/* Crosshair */}
                            <line x1="-10" y1="0" x2="10" y2="0" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            <line x1="0" y1="-10" x2="0" y2="10" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            <circle r="4" fill="none" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />

                            {/* Laser Spot (simulated) */}
                            {machineStatus.state === "RUN" && (
                                <circle r="2" fill="#ef4444" fillOpacity="0.8">
                                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.2s" repeatCount="indefinite" />
                                </circle>
                            )}
                        </g>
                    )}
                </svg>
            </div>

            <style>{`
                .panel--preview {
                    background: #fff;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .preview-container {
                    flex: 1;
                    flex: 1;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f1f5f9;
                }
                .preview-svg {
                    background: white;
                    max-width: 100%;
                    max-height: 100%;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
            `}</style>
        </div>
    );
}
