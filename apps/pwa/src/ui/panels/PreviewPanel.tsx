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
        <div ref={containerRef} className="preview-canvas-host">
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



    return (
        <div className={`panel panel--preview ${className || ""}`}>
            <div className="preview-container">
                <div className="preview-controls">
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
                    <div className="preview-gcode-layer">
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
            </div>
        </div>
    );
}
