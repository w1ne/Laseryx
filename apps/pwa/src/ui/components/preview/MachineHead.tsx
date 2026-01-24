import React from "react";
import { MachineStatus } from "../../../core/state/types";

type MachineHeadProps = {
    status?: MachineStatus;
};

export function MachineHead({ status }: MachineHeadProps) {
    if (!status) return null;

    return (
        <g transform={`translate(${status.wpos.x}, ${status.wpos.y})`}>
            {/* Crosshair */}
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle r="4" fill="none" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke" />

            {/* Laser Spot (simulated) */}
            {status.state === "RUN" && (
                <circle r="2" fill="#ef4444" fillOpacity="0.8">
                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.2s" repeatCount="indefinite" />
                </circle>
            )}
        </g>
    );
}
