import { useState, useRef, useCallback } from "react";

export type Viewport = {
    x: number;
    y: number;
    w: number;
    h: number; // h is usually derived from aspect ratio or independent?
    // For SVG viewBox, we need both w and h.
};

type UsePanZoomProps = {
    initialViewport: Viewport;
};

export function usePanZoom({ initialViewport }: UsePanZoomProps) {
    const [viewport, setViewport] = useState<Viewport>(initialViewport);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const direction = e.deltaY > 0 ? 1 : -1;
        const factor = 1 + direction * zoomSpeed;

        const rect = e.currentTarget.getBoundingClientRect();
        const cursorX = (e.clientX - rect.left) / rect.width;
        const cursorY = (e.clientY - rect.top) / rect.height;

        setViewport((prev) => {
            const newW = prev.w * factor;
            const newH = prev.h * factor;

            const worldX = prev.x + prev.w * cursorX;
            const worldY = prev.y + prev.h * cursorY;

            const newX = worldX - newW * cursorX;
            const newY = worldY - newH * cursorY;

            return { x: newX, y: newY, w: newW, h: newH };
        });
    }, []);


    // Revised Hook Strategy:
    // Expose `panTo`, `zoomTo`, `panBy`, `zoomAt` helpers.
    // And a ready-to-use `handlers` object for direct binding if simple.

    const startPan = useCallback((e: React.PointerEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }, []);

    const movePan = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;

        const dxPx = e.clientX - lastMouse.current.x;
        const dyPx = e.clientY - lastMouse.current.y;

        lastMouse.current = { x: e.clientX, y: e.clientY };

        const rect = e.currentTarget.getBoundingClientRect();

        setViewport(prev => {
            const scaleX = prev.w / rect.width;
            const scaleY = prev.h / rect.height;
            return {
                ...prev,
                x: prev.x - dxPx * scaleX,
                y: prev.y - dyPx * scaleY
            };
        });
    }, []);

    const endPan = useCallback((e: React.PointerEvent) => {
        isDragging.current = false;
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }, []);

    const zoomIn = useCallback(() => {
        setViewport(prev => ({
            ...prev,
            x: prev.x + prev.w * 0.1,
            y: prev.y + prev.h * 0.1,
            w: prev.w * 0.8,
            h: prev.h * 0.8
        }));
    }, []);

    const zoomOut = useCallback(() => {
        setViewport(prev => ({
            ...prev,
            x: prev.x - prev.w * 0.1,
            y: prev.y - prev.h * 0.1,
            w: prev.w * 1.2,
            h: prev.h * 1.2
        }));
    }, []);

    const resetView = useCallback(() => {
        setViewport(initialViewport);
    }, [initialViewport]);

    return {
        viewport,
        setViewport,
        handlers: {
            onWheel: handleWheel,
            onPointerDown: startPan,
            onPointerMove: movePan,
            onPointerUp: endPan
        },
        actions: {
            zoomIn,
            zoomOut,
            resetView
        }
    };
}
