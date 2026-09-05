import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoxDialog } from "./BoxDialog";

describe("BoxDialog", () => {
  it("keeps fabrication settings under one collapsed Advanced section", () => {
    render(<BoxDialog panelHeight={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Depth")).toBeTruthy();
    expect(screen.getByLabelText("Front height")).toBeTruthy();
    expect(screen.getByLabelText("Rear height")).toBeTruthy();
    expect(screen.getByLabelText("Stock thickness")).not.toBeVisible();
    fireEvent.click(screen.getByText("Advanced"));
    expect(screen.getByLabelText("Stock thickness")).toHaveValue(3);
    expect(screen.getByLabelText("Fit clearance")).toHaveValue(0.15);
    expect(screen.getByLabelText("Finger target")).toHaveValue(8);
    expect(screen.getByLabelText("Depth")).toHaveValue(95.394);
  });

  it("blocks an impossible slope without submitting malformed settings", () => {
    const onConfirm = vi.fn();
    render(<BoxDialog panelHeight={20} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Generate box" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/height difference must be less than the panel height/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
