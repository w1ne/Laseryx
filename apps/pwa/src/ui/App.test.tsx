import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { App } from "./App";
import { useStore } from "../core/state/store";
import { INITIAL_STATE } from "../core/state/types";

// Mock the store
vi.mock("../core/state/store", () => ({
    useStore: vi.fn(),
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
});
