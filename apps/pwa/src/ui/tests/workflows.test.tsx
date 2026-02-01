/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { App } from "../App";
import { createVirtualGrblDriver } from "../../io/grblDriver";
import { StoreProvider } from "../../core/state/store";

// --- Mocks Setup ---

// 1. Mock Workers first (global)
global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
}));

// 2. Mock Worker Client
vi.mock("../workerClient", () => ({
    createWorkerClient: () => ({
        ping: () => Promise.resolve(),
        dispose: vi.fn(),
        // Mock Generation response
        generateGcode: (_req: any) => Promise.resolve({
            ok: true,
            gcode: "G0 X0 Y0\nM3 S1000\nG1 X10 Y10\nM5",
            preview: []
        }),
    }),
}));

// 3. Mock Driver Singleton to return a REAL virtual driver (for state logic)
let virtualDriverInstance: any;

vi.mock("../../io/driverSingleton", () => ({
    getDriver: () => {
        if (!virtualDriverInstance) {
            virtualDriverInstance = createVirtualGrblDriver({
                responseDelayMs: 0 // Instant for tests
            });
        }
        return virtualDriverInstance;
    },
    isSimulation: vi.fn(() => true),
    setUseSimulation: vi.fn(),
}));

// 4. Mock Repositories
vi.mock("../../io/machineRepo", () => ({
    machineRepo: {
        initDefaults: vi.fn(),
        list: vi.fn(() => Promise.resolve([]))
    }
}));
vi.mock("../../io/materialRepo", () => ({
    materialRepo: {
        initDefaults: vi.fn(),
        list: vi.fn(() => Promise.resolve([]))
    }
}));
vi.mock("../../io/projectRepo", () => ({
    projectRepo: {
        list: () => Promise.resolve([]),
        save: vi.fn(),
        load: vi.fn(),
        delete: vi.fn(),
    },
}));

// Mock heavy UI components
vi.mock("../panels/PreviewPanel", () => ({ PreviewPanel: () => <div data-testid="preview-panel">Canvas Mock</div> }));

// Polyfill URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock");

describe("E2E Workflows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        virtualDriverInstance = null; // Reset driver
    });

    it("executes Raster Engraving Workflow (Image -> Generate -> Burn)", async () => {
        // 1. Render App
        render(
            <StoreProvider>
                <App />
            </StoreProvider>
        );

        expect(screen.getByText("Laseryx Workspace")).toBeInTheDocument();

        // 2. Simulate File Import (via Paste)
        const file = new File(["(fake-png-bytes)"], "logo.png", { type: "image/png" });
        const pasteEvent = new Event("paste", { bubbles: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: { files: [file] }
        });
        fireEvent(window, pasteEvent);

        // 3. Generate G-code (Design Tab)
        // Find "Generate G-code" button
        const generateBtn = await screen.findByText("Generate G-code");
        fireEvent.click(generateBtn);

        // 4. Switch to Machine Tab
        const machineTab = screen.getByText("Machine");
        fireEvent.click(machineTab);

        // 5. Connect Machine
        const connectBtn = await screen.findByText("Connect", {}, { timeout: 2000 });
        fireEvent.click(connectBtn);

        // Verify Connected
        await waitFor(() => {
            expect(virtualDriverInstance.isConnected()).toBe(true);
        });

        // 6. Arm & Start
        // Find Arm Laser checkbox
        const armCheckbox = screen.getByLabelText("Arm Laser");
        fireEvent.click(armCheckbox);

        // Find Start Job
        const startBtn = screen.getByText("Start Job");
        await waitFor(() => {
            expect(startBtn).not.toBeDisabled();
        });
        fireEvent.click(startBtn);

        // 7. Verify Execution
        await waitFor(() => {
            const sent = virtualDriverInstance.getSentLines();
            expect(sent.join("\n")).toContain("M3"); // G-code from mock
        }, { timeout: 2000 });
    });

    it("executes Vector Cutting Workflow (SVG -> Generate -> Burn)", async () => {
        // 1. Render App
        render(
            <StoreProvider>
                <App />
            </StoreProvider>
        );

        // 2. Simulate SVG Import
        const file = new File(["<svg>...</svg>"], "shape.svg", { type: "image/svg+xml" });
        const pasteEvent = new Event("paste", { bubbles: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: { files: [file] }
        });
        fireEvent(window, pasteEvent);

        // 3. Generate G-code (Design Tab)
        // Wait for generation button to appear/be ready?
        // Actually, paste handles import. Generate button is always there?
        const generateBtn = await screen.findByText("Generate G-code");
        fireEvent.click(generateBtn);

        // 4. Switch to Machine Tab
        const machineTab = screen.getByText("Machine");
        fireEvent.click(machineTab);

        // 5. Connect Machine
        const connectBtn = await screen.findByText("Connect", {}, { timeout: 2000 });
        fireEvent.click(connectBtn);

        // Verify Connected
        await waitFor(() => {
            expect(virtualDriverInstance.isConnected()).toBe(true);
        });

        // 6. Arm & Start
        const armCheckbox = screen.getByLabelText("Arm Laser");
        fireEvent.click(armCheckbox);

        const startBtn = screen.getByText("Start Job");
        await waitFor(() => {
            expect(startBtn).not.toBeDisabled();
        });
        fireEvent.click(startBtn);

        // 7. Verify Execution
        await waitFor(() => {
            const sent = virtualDriverInstance.getSentLines();
            expect(sent.length).toBeGreaterThan(0);
            expect(sent.join("\n")).toContain("M3"); // Verify laser on
        }, { timeout: 2000 });
    });
});
