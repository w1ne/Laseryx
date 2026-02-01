// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePanZoom } from "./usePanZoom";

// Mock React.WheelEvent and PointerEvent
// We'll just pass partial objects that satisfy the handler needs

describe("usePanZoom", () => {
    it("should initialize with default viewport", () => {
        const initial = { x: 0, y: 0, w: 100, h: 100 };
        const { result } = renderHook(() => usePanZoom({ initialViewport: initial }));
        expect(result.current.viewport).toEqual(initial);
    });

    it("should zoom in via action", () => {
        const initial = { x: 0, y: 0, w: 100, h: 100 };
        const { result } = renderHook(() => usePanZoom({ initialViewport: initial }));

        act(() => {
            result.current.actions.zoomIn();
        });

        // Zoom in factor 0.8
        // Center logic: x + w*0.1 = 0 + 10 = 10
        expect(result.current.viewport.w).toBe(80);
        expect(result.current.viewport.h).toBe(80);
        expect(result.current.viewport.x).toBe(10);
        expect(result.current.viewport.y).toBe(10);
    });

    it("should reset view", () => {
        const initial = { x: 0, y: 0, w: 100, h: 100 };
        const { result } = renderHook(() => usePanZoom({ initialViewport: initial }));

        act(() => {
            result.current.actions.zoomIn();
            result.current.actions.resetView();
        });

        expect(result.current.viewport).toEqual(initial);
    });
});
