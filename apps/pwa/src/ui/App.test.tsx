import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { useStore } from "../core/state/store";
import { INITIAL_STATE } from "../core/state/types";

// Mock the store
vi.mock("../core/state/store", () => ({
    useStore: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StoreProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock IO and other dependencies that use browser APIs not available in happy-dom or need isolation
vi.mock("../io/driverSingleton", () => ({
    getDriver: () => ({
        isConnected: () => false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getStatus: vi.fn(),
    }),
    isSimulation: () => false,
    setUseSimulation: vi.fn(),
}));

vi.mock("./workerClient", () => ({
    createWorkerClient: () => ({
        ping: () => Promise.resolve(),
        dispose: vi.fn(),
    }),
}));

vi.mock("../io/projectRepo", () => ({
    projectRepo: {
        list: () => Promise.resolve([]),
        save: vi.fn(),
        load: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock("../io/machineRepo", () => ({
    machineRepo: {
        initDefaults: () => Promise.resolve(),
        list: () => Promise.resolve([]),
    },
}));

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
}));

describe("App", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (useStore as any).mockReturnValue({
            state: INITIAL_STATE,
            dispatch: vi.fn(),
        });
    });

    it("renders the main title", () => {
        render(<App />);
        expect(screen.getByText(/Laseryx Workspace/i)).toBeInTheDocument();
    });

    it("renders the workspace mode controls", () => {
        render(<App />);
        const modeControls = screen.getByRole("group", { name: "Workspace mode" });
        expect(modeControls.tagName).toBe("DIV");
        expect(within(modeControls).getByText("Design")).toBeInTheDocument();
        expect(within(modeControls).getByText("Machine")).toBeInTheDocument();
    });

    it("renders compact shell command and mobile panel controls", () => {
        render(<App />);

        expect(screen.getByRole("group", { name: "Project actions" })).toBeInTheDocument();
        expect(screen.getByRole("tablist", { name: "Design panels" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Objects" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "false");
        expect(screen.getByRole("tab", { name: "Operations" })).toHaveAttribute("aria-selected", "false");
    });

    it("renders a compact workbench top bar with mode controls", () => {
        render(<App />);

        expect(screen.getByRole("banner")).toHaveClass("app__topbar");
        expect(screen.getByRole("group", { name: "Workspace mode" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Project actions" })).toBeInTheDocument();
        expect(screen.getByText(/Release/i)).toBeInTheDocument();
    });

    it("renders desktop workbench zones for design mode", () => {
        render(<App />);

        expect(screen.getByRole("region", { name: "Document navigation" })).toHaveClass("app__left-zone");
        expect(screen.getByRole("region", { name: "Laser bed workspace" })).toHaveClass("app__canvas-zone");
        expect(screen.getByRole("region", { name: "Inspector and operations" })).toHaveClass("app__right-zone");
    });

    it("places design panels into left and right desktop zones", () => {
        render(<App />);

        const leftZone = screen.getByRole("region", { name: "Document navigation" });
        const rightZone = screen.getByRole("region", { name: "Inspector and operations" });

        expect(within(leftZone).getByTestId("design-panel-document")).toBeInTheDocument();
        expect(within(rightZone).getByTestId("design-panel-properties")).toBeInTheDocument();
        expect(within(rightZone).getByTestId("design-panel-layers")).toBeInTheDocument();
    });

    it("marks desktop wrapper zones with mobile panel state", () => {
        render(<App />);

        const leftZone = screen.getByRole("region", { name: "Document navigation" });
        const canvasZone = screen.getByRole("region", { name: "Laser bed workspace" });
        const rightZone = screen.getByRole("region", { name: "Inspector and operations" });

        expect(leftZone).toHaveAttribute("data-mobile-panel", "active");
        expect(canvasZone).toHaveAttribute("data-mobile-panel", "canvas");
        expect(rightZone).toHaveAttribute("data-mobile-panel", "inactive");

        fireEvent.click(screen.getByRole("tab", { name: "Operations" }));

        expect(leftZone).toHaveAttribute("data-mobile-panel", "inactive");
        expect(rightZone).toHaveAttribute("data-mobile-panel", "active");

        fireEvent.click(screen.getByRole("tab", { name: "Properties" }));

        expect(leftZone).toHaveAttribute("data-mobile-panel", "inactive");
        expect(rightZone).toHaveAttribute("data-mobile-panel", "active");
    });

    it("renders machine mode workbench regions without design zones", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (useStore as any).mockReturnValue({
            state: {
                ...INITIAL_STATE,
                ui: {
                    ...INITIAL_STATE.ui,
                    activeTab: "machine",
                },
            },
            dispatch: vi.fn(),
        });

        render(<App />);

        expect(screen.getByRole("region", { name: "Machine controls" })).toHaveAttribute("data-mobile-panel", "active");
        expect(screen.getByRole("region", { name: "Laser bed workspace" })).toHaveAttribute("data-mobile-panel", "canvas");
        expect(screen.queryByRole("region", { name: "Document navigation" })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Inspector and operations" })).not.toBeInTheDocument();
    });

    it("switches the active design panel tab", () => {
        render(<App />);

        fireEvent.click(screen.getByRole("tab", { name: "Operations" }));

        expect(screen.getByRole("tab", { name: "Objects" })).toHaveAttribute("aria-selected", "false");
        expect(screen.getByRole("tab", { name: "Operations" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId("design-panel-layers")).toHaveAttribute("data-mobile-panel", "active");
    });

    it("links design panel tabs to their tabpanels", () => {
        render(<App />);

        const operationsTab = screen.getByRole("tab", { name: "Operations" });
        const layersPanel = screen.getByTestId("design-panel-layers");

        expect(operationsTab).toHaveAttribute("id", "design-panel-tab-layers");
        expect(operationsTab).toHaveAttribute("aria-controls", "design-panel-layers");
        expect(layersPanel).toHaveAttribute("role", "tabpanel");
        expect(layersPanel).toHaveAttribute("id", "design-panel-layers");
        expect(layersPanel).toHaveAttribute("aria-labelledby", "design-panel-tab-layers");
        expect(layersPanel).not.toHaveAttribute("aria-hidden");

        fireEvent.click(operationsTab);

        expect(layersPanel).toHaveAttribute("data-mobile-panel", "active");
        expect(layersPanel).not.toHaveAttribute("aria-hidden");
    });
});
