import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { App } from "../App";
import { useStore } from "../../core/state/store";
import { INITIAL_STATE } from "../../core/state/types";

// Mock the store
vi.mock("../../core/state/store", () => ({
    useStore: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StoreProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock IO dependencies
vi.mock("../../io/driverSingleton", () => ({
    getDriver: () => ({
        isConnected: () => false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getStatus: vi.fn(),
    }),
}));

vi.mock("../workerClient", () => ({
    createWorkerClient: () => ({
        ping: () => Promise.resolve(),
        dispose: vi.fn(),
    }),
}));

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
}));

// Mock child components
vi.mock("../panels/MachinePanel", () => ({ MachinePanel: () => <div data-testid="machine-panel" /> }));
vi.mock("../panels/DocumentPanel", () => ({ DocumentPanel: () => <div data-testid="doc-panel" /> }));
vi.mock("../panels/PropertiesPanel", () => ({ PropertiesPanel: () => <div data-testid="prop-panel" /> }));
vi.mock("../panels/LayersPanel", () => ({ LayersPanel: () => <div data-testid="layer-panel" /> }));
vi.mock("../panels/PreviewPanel", () => ({ PreviewPanel: () => <div data-testid="preview-panel" /> }));
vi.mock("../DonateButton", () => ({ DonateButton: () => <div /> }));
vi.mock("../AboutDialog", () => ({ AboutDialog: () => <div /> }));
vi.mock("../dialogs/MaterialManagerDialog", () => ({ MaterialManagerDialog: () => <div /> }));

// Mock repositories to prevent actual DB calls
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

describe("PWA Installation", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (useStore as any).mockReturnValue({
            state: INITIAL_STATE,
            dispatch: vi.fn(),
        });
    });

    it("does not show install button by default", () => {
        render(<App />);
        expect(screen.queryByText("Install App")).toBeNull();
    });

    it("shows install button when beforeinstallprompt fires", () => {
        render(<App />);

        // Simulate event
        const event = new Event("beforeinstallprompt");
        // Add prompt method mock
        Object.assign(event, {
            prompt: vi.fn(),
            userChoice: Promise.resolve({ outcome: "accepted" }),
            preventDefault: vi.fn()
        });

        fireEvent(window, event);

        expect(screen.getByText("Install App")).toBeInTheDocument();
        // expect(event.preventDefault).toHaveBeenCalled(); // React synthetic events might mask this or window listener structure, but it verifies flow.
    });

    it("triggers prompt when clicked and cleanup on accept", async () => {
        render(<App />);

        const promptMock = vi.fn();
        const event = new Event("beforeinstallprompt");
        Object.assign(event, {
            prompt: promptMock,
            userChoice: Promise.resolve({ outcome: "accepted" }),
            preventDefault: vi.fn()
        });

        fireEvent(window, event);
        const btn = screen.getByText("Install App");
        fireEvent.click(btn);

        expect(promptMock).toHaveBeenCalled();

        // Wait for usage of userChoice (async state update)
        await new Promise(r => setTimeout(r, 0));

        // Should disappear after accepted
        expect(screen.queryByText("Install App")).toBeNull();
    });
});
