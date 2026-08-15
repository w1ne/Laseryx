import React, { ReactNode } from "react";
import { OriginAxes } from "./OriginAxes";

type BedBackgroundProps = {
    width: number;
    height: number;
    children?: ReactNode;
    onPanStart?: (e: React.PointerEvent) => void;
    isDragging?: boolean;
    /** Show machine origin axes at (0,0). Default true. */
    showOrigin?: boolean;
    /** World Y is flipped for front-left machine origin. */
    yFlipped?: boolean;
    /** Visible viewport width in mm — keeps the origin marker a constant
     *  on-screen size as the user zooms. Defaults to the bed width. */
    viewMm?: number;
};

export function BedBackground({
    width,
    height,
    children,
    onPanStart,
    isDragging,
    showOrigin = true,
    yFlipped = true,
    viewMm
}: BedBackgroundProps) {
    return (
        <>
            <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#94a3b8" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                </pattern>
            </defs>

            {/* Bed Background - Handle click for Pan (machine coords 0…w × 0…h) */}
            <rect
                x="0" y="0"
                width={width} height={height}
                fill="#f8fafc"
                onPointerDown={onPanStart}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
            />
            <rect
                x="0" y="0"
                width={width} height={height}
                fill="url(#grid)"
                pointerEvents="none"
            />

            {/* Origin (0,0) — lower-left when world is Y-up flipped for frontLeft */}
            {showOrigin && <OriginAxes yFlipped={yFlipped} viewMm={viewMm ?? width} />}

            {children}
        </>
    );
}
