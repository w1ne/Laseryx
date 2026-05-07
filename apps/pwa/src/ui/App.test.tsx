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

    it("renders the navigation tabs", () => {
        render(<App />);
        const nav = screen.getByRole("navigation");
        expect(within(nav).getByText("Design")).toBeInTheDocument();
        expect(within(nav).getByText("Machine")).toBeInTheDocument();
    });

    it("renders compact shell command and mobile panel controls", () => {
        render(<App />);

        expect(screen.getByRole("group", { name: "Project actions" })).toBeInTheDocument();
        expect(screen.getByRole("tablist", { name: "Design panels" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Objects" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "false");
        expect(screen.getByRole("tab", { name: "Operations" })).toHaveAttribute("aria-selected", "false");
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
