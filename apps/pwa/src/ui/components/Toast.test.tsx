import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast, ToastContainer } from "./Toast";

describe("Toast", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("should render success toast with correct styling", () => {
        const onDismiss = vi.fn();
        const { container } = render(
            <Toast
                id="test-1"
                type="success"
                message="Test success message"
                onDismiss={onDismiss}
            />
        );

        expect(screen.getByText("Test success message")).toBeInTheDocument();
        expect(screen.getByText("✓")).toBeInTheDocument();
        const toastDiv = container.querySelector("div");
        expect(toastDiv).toHaveStyle({ background: "#10b981" });
    });

    it("should render error toast with correct styling", () => {
        const onDismiss = vi.fn();
        const { container } = render(
            <Toast
                id="test-2"
                type="error"
                message="Test error message"
                onDismiss={onDismiss}
            />
        );

        expect(screen.getByText("Test error message")).toBeInTheDocument();
        expect(screen.getByText("✕")).toBeInTheDocument();
        const toastDiv = container.querySelector("div");
        expect(toastDiv).toHaveStyle({ background: "#ef4444" });
    });

    it("should auto-dismiss after duration", async () => {
        const onDismiss = vi.fn();
        render(
            <Toast
                id="test-3"
                type="info"
                message="Auto dismiss test"
                duration={3000}
                onDismiss={onDismiss}
            />
        );

        expect(onDismiss).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3000);

        expect(onDismiss).toHaveBeenCalledWith("test-3");
    });

    it("should dismiss when close button clicked", () => {
        const onDismiss = vi.fn();
        render(
            <Toast
                id="test-4"
                type="warning"
                message="Manual dismiss test"
                onDismiss={onDismiss}
            />
        );

        const closeButton = screen.getByText("×");
        closeButton.click();

        expect(onDismiss).toHaveBeenCalledWith("test-4");
    });
});

describe("ToastContainer", () => {
    it("should render multiple toasts", () => {
        const onDismiss = vi.fn();
        const toasts = [
            { id: "1", type: "success" as const, message: "Toast 1", onDismiss },
            { id: "2", type: "error" as const, message: "Toast 2", onDismiss },
            { id: "3", type: "info" as const, message: "Toast 3", onDismiss }
        ];

        render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

        expect(screen.getByText("Toast 1")).toBeInTheDocument();
        expect(screen.getByText("Toast 2")).toBeInTheDocument();
        expect(screen.getByText("Toast 3")).toBeInTheDocument();
    });

    it("should limit to 3 toasts", () => {
        const onDismiss = vi.fn();
        const toasts = [
            { id: "1", type: "success" as const, message: "Toast 1", onDismiss },
            { id: "2", type: "error" as const, message: "Toast 2", onDismiss },
            { id: "3", type: "info" as const, message: "Toast 3", onDismiss },
            { id: "4", type: "warning" as const, message: "Toast 4", onDismiss }
        ];

        render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

        expect(screen.getByText("Toast 1")).toBeInTheDocument();
        expect(screen.getByText("Toast 2")).toBeInTheDocument();
        expect(screen.getByText("Toast 3")).toBeInTheDocument();
        expect(screen.queryByText("Toast 4")).not.toBeInTheDocument();
    });
});
