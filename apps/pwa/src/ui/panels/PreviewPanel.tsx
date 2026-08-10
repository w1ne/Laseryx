import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../core/state/store";
import { MachineStatus } from "../../core/state/types";
import type { Document } from "../../core/model";
import { parseGcode, type GcodeMove } from "../../core/gcodeParser";
import { usePanZoom, type Viewport } from "../hooks/usePanZoom";

import { BedBackground } from "../components/preview/BedBackground";
import { DesignView, type ObjectTransformPatch } from "../components/preview/DesignView";
import { CanvasGcodeView } from "../components/preview/CanvasGcodeView";
import { MachineHead } from "../components/preview/MachineHead";
import { ObjectService } from "../../core/services/ObjectService";
import { SketchDrawLayer } from "../components/SketchDrawLayer";
import { useSketchTool } from "../sketch/SketchContext";
import { SketchService } from "../../core/services/SketchService";
import { GroupService } from "../../core/services/GroupService";
import { DimensionPickLayer } from "../components/DimensionPickLayer";
import { DimensionHud } from "../components/DimensionHud";
import { DimAnnotationsLayer } from "../components/preview/DimAnnotationsLayer";
import {
    machineWorldTransformForProfile,
    worldIsYFlipped
} from "../components/preview/worldTransform";

type PreviewPanelProps = {
    className?: string;
    showMachineHead?: boolean;
    machineStatus?: MachineStatus;
    gcode?: string;
    viewMode?: "design" | "gcode";
};

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
    const { document: doc, machineProfile, selectedObjectId, selectedObjectIds, selectedConstraintId } = state;
    const { tool, setTool } = useSketchTool();
    const drawing =
      viewMode === "design" &&
      tool !== "select" &&
      tool !== "import" &&
      tool !== "dimension";
    const dimensioning = viewMode === "design" && tool === "dimension";
    /** Snapshot at start of group/multi drag for absolute deltas. */
    const groupDragBaseRef = useRef<Document | null>(null);

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
            <div className="preview-container" style={{ position: "relative" }}>
                <DimensionHud />
                <div className="preview-controls">
                    <button type="button" className="icon-btn" onClick={actions.zoomIn} title="Zoom in on the bed">+</button>
                    <button type="button" className="icon-btn" onClick={actions.zoomOut} title="Zoom out">-</button>
                    <button type="button" className="icon-btn" onClick={actions.resetView} title="Fit the full machine bed in view">[]</button>
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
                        // Middle mouse always pans (CAD-style)
                        if (e.button === 1) handlers.onPointerDown(e);
                    }}
                    onPointerMove={handlers.onPointerMove}
                    onPointerUp={handlers.onPointerUp}
                    onPointerLeave={handlers.onPointerUp}
                >
                    {/*
                      Machine world: origin front-left at (0,0), +X right, +Y toward rear.
                      For frontLeft this group is Y-flipped so origin sits lower-left on screen.
                    */}
                    <g
                      className="machine-world"
                      data-testid="machine-world"
                      transform={
                        machineWorldTransformForProfile(
                          machineProfile.bedMm,
                          machineProfile.origin
                        ) ?? undefined
                      }
                    >
                    <BedBackground
                        width={machineProfile.bedMm.w}
                        height={machineProfile.bedMm.h}
                        yFlipped={worldIsYFlipped(machineProfile.origin)}
                        onPanStart={(e) => {
                            // Never pan with left button while creating geometry or dimensions
                            if (e.button === 0 && !drawing && !dimensioning) {
                                dispatch({ type: "SELECT_OBJECT", payload: null });
                                handlers.onPointerDown(e);
                            }
                        }}
                        isDragging={false}
                    >
                        {/* Objects first (visible). Draw/Dim layers sit ON TOP when those tools are active
                            so one press-drag creates geometry (objects must not steal the first click). */}
                        {viewMode === "design" && (
                            <g
                              style={{
                                // While drawing/dimensioning, ignore object hits entirely
                                pointerEvents: drawing || dimensioning ? "none" : "auto"
                              }}
                            >
                            <DesignView
                                objects={doc.objects}
                                selectedId={selectedObjectId || undefined}
                                selectedIds={selectedObjectIds}
                                sketch={doc.sketch}
                                yFlipped={worldIsYFlipped(machineProfile.origin)}
                                onSelect={(id, opts) => {
                                    if (drawing || dimensioning) return;
                                    return GroupService.selectWithGroup(state, dispatch, id, opts);
                                }}
                                onPatchObject={(id, patch: ObjectTransformPatch, opts) => {
                                    if (opts?.commit) {
                                        ObjectService.commitHistory(dispatch);
                                        return;
                                    }
                                    ObjectService.updateObject(
                                        dispatch,
                                        id,
                                        patch as Parameters<typeof ObjectService.updateObject>[2],
                                        { skipHistory: opts?.skipHistory }
                                    );
                                }}
                                onMoveSketchPoint={(pointId, x, y, live) => {
                                    // Origin is fixed — never drag it
                                    if (pointId === "pt-origin") return;
                                    SketchService.moveSketchPoint(state, dispatch, pointId, x, y, {
                                        skipSolve: live,
                                        selectObjectId: selectedObjectId
                                    });
                                }}
                                onTranslateSelection={(dx, dy, live, memberIds) => {
                                    const ids =
                                        memberIds.length > 0
                                            ? memberIds
                                            : selectedObjectIds.length > 0
                                              ? selectedObjectIds
                                              : selectedObjectId
                                                ? [selectedObjectId]
                                                : [];
                                    if (ids.length === 0) return;
                                    if (!live) {
                                        groupDragBaseRef.current = null;
                                        ObjectService.commitHistory(dispatch);
                                        if (state.document.sketch) {
                                            SketchService.reSolve(state, dispatch);
                                        }
                                        return;
                                    }
                                    if (!groupDragBaseRef.current) {
                                        groupDragBaseRef.current = structuredClone(state.document);
                                    }
                                    GroupService.translateSelection(state, dispatch, ids, dx, dy, {
                                        live: true,
                                        baseDocument: groupDragBaseRef.current
                                    });
                                }}
                            />
                            </g>
                        )}

                        {/* Dim annotations always above geometry so Select → click dim → Delete works.
                            Sit under active Draw/Dim capture layers (those tools take the full bed). */}
                        {viewMode === "design" && (
                          <DimAnnotationsLayer
                            sketch={doc.sketch}
                            selectedConstraintId={selectedConstraintId}
                            yFlipped={worldIsYFlipped(machineProfile.origin)}
                            onSelectConstraint={(id) =>
                              dispatch({ type: "SELECT_CONSTRAINT", payload: id })
                            }
                            onMoveOffset={(id, offsetMm, live) => {
                              // live moves skip history; pointer-up writes one undo snapshot
                              SketchService.setDimOffset(state, dispatch, id, offsetMm, {
                                live
                              });
                            }}
                          />
                        )}

                        {/* Full-bed capture while create tool is active — one drag = one shape */}
                        <SketchDrawLayer enabled={drawing} />
                        <DimensionPickLayer enabled={dimensioning} />

                        {showMachineHead && (
                            <MachineHead status={machineStatus} />
                        )}
                    </BedBackground>
                    </g>
                </svg>
            </div>
        </div>
    );
}
