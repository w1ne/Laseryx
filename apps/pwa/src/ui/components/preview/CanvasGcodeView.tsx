import React, { useEffect, useRef } from "react";
import { GcodeMove } from "../../../core/gcodeParser";
import { Viewport } from "../../hooks/usePanZoom";

type CanvasGcodeViewProps = {
    moves: GcodeMove[];
    viewport: Viewport;
    width: number;
    height: number;
};

export function CanvasGcodeView({ moves, viewport, width, height }: CanvasGcodeViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Calculate Transform to match SVG preserveAspectRatio="xMidYMid meet"
        // 1. Determine Scale (Meet)
        const scaleX = width / viewport.w;
        const scaleY = height / viewport.h;
        const scale = Math.min(scaleX, scaleY);

        // 2. Determine Centering Offsets (xMidYMid)
        const renderW = viewport.w * scale;
        const renderH = viewport.h * scale;
        const offX = (width - renderW) / 2;
        const offY = (height - renderH) / 2;

        const offsetX = offX - viewport.x * scale;
        const offsetY = offY - viewport.y * scale;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // Batch paths by style to minimize state changes
        ctx.lineWidth = 1 / scale; // Constant screen width lines? Or scalable? 
        // SVG was using vector-effect="non-scaling-stroke", so constant screen width.
        // In Canvas, we must inverse-scale line width.

        // 1. Draw Travel Moves (Dashed, Gray)
        ctx.beginPath();
        for (const move of moves) {
            if (move.type === "travel") {
                ctx.moveTo(move.from.x, move.from.y);
                ctx.lineTo(move.to.x, move.to.y);
            }
        }
        ctx.strokeStyle = "#94a3b8";
        // ctx.setLineDash([2 / scale, 2 / scale]); // Dashed line adjusted for scale
        // Dashed lines in Canvas are expensive at huge scale. Let's try simple first or optimized.
        // Actually, just solid gray is fine for performance, or use simple dash.
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 0.5 / scale;
        ctx.setLineDash([2 / scale, 2 / scale]);
        ctx.stroke();
        ctx.restore();

        // 2. Draw Cut Moves (Solid, Red)
        // Since opacity varies per line (power), typically needs individual strokes.
        // BATCH OPTIMIZATION: Group by power? Or if mostly constant...
        // For lasers, grayscale power is common.
        // "Opacity indicating power level" was the requirement.
        // Drawing thousands of individual strokes is slower than one path.
        // Compromise: Draw all cuts as one path with simple Red color first for speed?
        // User asked for performance. Individual strokes for 100k lines is heavy.
        // PROPOSAL: Bin power into levels (e.g. 10 levels) or just use solid red for now.
        // Let's iterate and stroke individually only if count is low? 
        // Or simpler: Global Red with average opacity?
        // Let's try individual first (Canvas is fast), but if 100k lines...
        // Let's do BATCHING by opacity if possible, but they are interleaved.
        // Fast path: Just draw them.

        // Actually, simple iteration is often fast enough on Canvas compared to DOM.

        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1 / scale;

        // We will try to batch segments of similar power if sequential, 
        // but easier to just draw.
        // OPTIMIZATION: If moves > 10000, ignore opacity per line and do batch?

        const USE_BATCH = moves.length > 5000;

        if (USE_BATCH) {
            ctx.beginPath();
            for (const move of moves) {
                if (move.type === "cut") {
                    ctx.moveTo(move.from.x, move.from.y);
                    ctx.lineTo(move.to.x, move.to.y);
                }
            }
            ctx.globalAlpha = 0.8;
            ctx.stroke();
        } else {
            for (const move of moves) {
                if (move.type === "cut") {
                    ctx.beginPath();
                    ctx.moveTo(move.from.x, move.from.y);
                    ctx.lineTo(move.to.x, move.to.y);
                    // Opacity: (power / 1000) * 0.8 + 0.2
                    ctx.globalAlpha = (move.power / 1000) * 0.8 + 0.2;
                    ctx.stroke();
                }
            }
        }

        ctx.restore();

    }, [moves, viewport, width, height]);

    return <canvas ref={canvasRef} style={{ pointerEvents: "none" }} />;
}
