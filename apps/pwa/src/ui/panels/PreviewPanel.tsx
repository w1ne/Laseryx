import React, { useMemo } from "react";
import { useStore } from "../../core/state/store";
import { MachineStatus } from "../../core/state/types";
import { parseGcode } from "../../core/gcodeParser";
import { usePanZoom } from "../hooks/usePanZoom";

import { BedBackground } from "../components/preview/BedBackground";
import { DesignView } from "../components/preview/DesignView";
// import { GcodeView } from "../components/preview/GcodeView"; // Replaced by Canvas
import { CanvasGcodeView } from "../components/preview/CanvasGcodeView";
import { MachineHead } from "../components/preview/MachineHead";

type PreviewPanelProps = {
    className?: string;
    showMachineHead?: boolean;
    machineStatus?: MachineStatus;
    gcode?: string;
    viewMode?: "design" | "gcode";
};

// Helper component to size canvas to container
import { useRef, useEffect, useState } from "react";
import { GcodeMove } from "../../core/gcodeParser";
import { Viewport } from "../hooks/usePanZoom";

function AutoResizingCanvas({ moves, viewport }: { moves: GcodeMove[], viewport: Viewport }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setSize({ w: width, h: height });
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            {size.w > 0 && (
                <CanvasGcodeView
                    moves={moves}
                    viewport={viewport}
                    width={size.w}
                    height={size.h}
                />
            )}
        </div>
    );
}

export function PreviewPanel({
    className,
    showMachineHead,
    machineStatus,
    gcode,
    viewMode = "design"
}: PreviewPanelProps) {
    const { state, dispatch } = useStore();
    const { document: doc, machineProfile, selectedObjectId } = state;

    // Default to machine bed size 
    const initialViewport = useMemo(() => ({ x: 0, y: 0, w: machineProfile.bedMm.w, h: machineProfile.bedMm.h }), [machineProfile.bedMm]);

    const { viewport, handlers, actions } = usePanZoom({ initialViewport });

    // Parse G-code only when it changes
    const moves = useMemo(() => {
        if (viewMode === "gcode" && gcode) {
            return parseGcode(gcode).moves;
        }
        return [];
    }, [gcode, viewMode]);

    // Allow panning with left click if target is the background
    const handleBackgroundDown = (e: React.PointerEvent) => {
        if (e.button === 0) {
            handlers.onPointerDown(e);
        }
    };

    return (
        <div className={`panel panel--preview ${className || ""}`}>
            <div className="preview-container" style={{ position: "relative", overflow: "hidden" }}>
                <div className="preview-controls" style={{
                    position: "absolute",
                    bottom: "16px",
                    right: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    background: "#fff",
                    borderRadius: "6px",
                    padding: "4px",
                    zIndex: 20
                }}>
                    <button className="icon-btn" onClick={actions.zoomIn} title="Zoom In">+</button>
                    <button className="icon-btn" onClick={actions.zoomOut} title="Zoom Out">-</button>
                    <button className="icon-btn" onClick={actions.resetView} title="Fit to Bed">[]</button>
                </div>

                {/* 
                    Layer 1: Canvas G-code Rendering
                    Absolute positioned to cover the container. 
                    Only visible in G-code mode.
                */}
                {viewMode === "gcode" && (
                    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 12 }}>
                        <AutoResizingCanvas
                            moves={moves}
                            viewport={viewport}
                        />
                    </div>
                )}


                {/* Layer 2: SVG for Grid, Bed, Design, Interaction */}
                <svg
                    className="preview-svg"
                    viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
                    preserveAspectRatio="xMidYMid meet"
                    onWheel={handlers.onWheel}
                    onPointerDown={(e) => {
                        if (e.button === 1) handlers.onPointerDown(e);
                    }}
                    onPointerMove={handlers.onPointerMove}
                    onPointerUp={handlers.onPointerUp}
                    onPointerLeave={handlers.onPointerUp}
                    style={{ touchAction: "none", position: "relative", zIndex: 10 }}
                >
                    <BedBackground
                        width={machineProfile.bedMm.w}
                        height={machineProfile.bedMm.h}
                        onPanStart={handlers.onPointerDown}
                        isDragging={false}
                    >
                        {viewMode === "design" && (
                            <DesignView
                                objects={doc.objects}
                                selectedId={selectedObjectId || undefined}
                                onSelect={(id) => dispatch({ type: "SELECT_OBJECT", payload: id })}
                            />
                        )}

                        {showMachineHead && (
                            <MachineHead status={machineStatus} />
                        )}
                    </BedBackground>
                </svg>

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
                        background: transparent;
                        max-width: 100%;
                        max-height: 100%;
                    }
                    .icon-btn {
                        width: 24px; 
                        height: 24px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        border: 1px solid #e2e8f0;
                        background: #f8fafc;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        color: #475569;
                    }
                    .icon-btn:hover {
                        background: #f1f5f9;
                        color: #1e293b;
                    }
                `}</style>
            </div>
        </div>
    );
}
