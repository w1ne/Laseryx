// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { CanvasGcodeView } from "./CanvasGcodeView";
import { MachineHead } from "./MachineHead";

// ...

describe("CanvasGcodeView", () => {
    it("renders a canvas element", () => {
        const moves = [
            { type: "travel" as const, from: { x: 0, y: 0 }, to: { x: 10, y: 10 }, power: 0, speed: 1000 }
        ];
        const viewport = { x: 0, y: 0, w: 100, h: 100 };
        const { container } = render(
            <CanvasGcodeView moves={moves} viewport={viewport} width={100} height={100} />
        );
        expect(container.querySelector("canvas")).not.toBeNull();
    });
});


describe("MachineHead", () => {
    it("renders nothing if status is missing", () => {
        const { container } = render(<svg><MachineHead /></svg>);
        expect(container.querySelector("g")).toBeNull();
    });

    it("renders at correct position", () => {
        // @ts-expect-error Mocking status with string
        const status = { state: "Idle", wpos: { x: 50, y: 50 }, mpos: { x: 0, y: 0 }, feed: 0, spindle: 0 };
        const { container } = render(<svg><MachineHead status={status} /></svg>);
        const g = container.querySelector("g");
        expect(g?.getAttribute("transform")).toBe("translate(50, 50)");
    });
});
