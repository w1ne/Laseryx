import React, { ReactNode } from "react";

type BedBackgroundProps = {
    width: number;
    height: number;
    children?: ReactNode;
    onPanStart?: (e: React.PointerEvent) => void;
    isDragging?: boolean;
};

export function BedBackground({ width, height, children, onPanStart, isDragging }: BedBackgroundProps) {
    return (
        <>
            <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#94a3b8" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                </pattern>
            </defs>

            {/* Bed Background - Handle click for Pan */}
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

            {/* Machine Origin Indicator (Bottom Left) */}
            <path d="M 0 20 L 0 0 L 20 0" fill="none" stroke="#cbd5e1" strokeWidth="2" vectorEffect="non-scaling-stroke" />

            {children}
        </>
    );
}
