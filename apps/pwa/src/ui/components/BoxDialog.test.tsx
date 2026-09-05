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
    expect(screen.getByText(/Estimated A5 sheets:/)).toBeTruthy();
  });

  it("allows depth edits but blocks geometry that requires a different panel", () => {
    render(<BoxDialog panelHeight={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Depth"), { target: { value: "80" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Depth and heights require a 85\.44 mm panel; adjust values or panel size/i);
    expect(screen.getByRole("button", { name: "Generate box" })).toBeDisabled();
  });

  it("blocks an impossible slope without submitting malformed settings", () => {
    const onConfirm = vi.fn();
    render(<BoxDialog panelHeight={20} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Generate box" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/height difference must be less than the panel height/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("initializes every persisted fabrication and layout field", () => {
    render(<BoxDialog panelHeight={100} initial={{ frontHeight: 20, rearHeight: 40, thickness: 4, clearance: .2, fingerTarget: 9, sheetWidth: 300, sheetHeight: 200, orientation: "portrait", margin: 7, gap: 4, includeCoupon: true }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Front height")).toHaveValue(20);
    fireEvent.click(screen.getByText("Advanced"));
    expect(screen.getByLabelText("Stock thickness")).toHaveValue(4);
    expect(screen.getByLabelText("Sheet width")).toHaveValue(300);
    expect(screen.getByLabelText("Sheet orientation")).toHaveValue("portrait");
    expect(screen.getByLabelText("Include fit coupon")).toBeChecked();
  });
});
