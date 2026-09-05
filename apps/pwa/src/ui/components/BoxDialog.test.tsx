import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoxDialog, boxPackingIssue } from "./BoxDialog";

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
    expect(screen.getByText(/Estimated 210 × 148 mm sheets:/)).toBeTruthy();
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

  it("blocks a face that cannot fit the selected stock in either orientation", () => {
    render(<BoxDialog panelWidth={205} panelHeight={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Source panel cannot fit the selected 210 × 148 mm sheet/i);
    expect(screen.getByRole("button", { name: "Generate box" })).toBeDisabled();
  });

  it("accepts rotation-fit faces and labels estimates with custom stock dimensions", () => {
    render(<BoxDialog panelWidth={130} panelHeight={100} initial={{ sheetWidth: 180, sheetHeight: 148 }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/cannot fit/i)).toBeNull();
    expect(screen.getByText(/Estimated 180 × 148 mm sheets:/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate box" })).toBeEnabled();
  });

  it("exposes the same defensive packing issue used by box generation", () => {
    expect(boxPackingIssue({ depth: 95.394, frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8, sheetWidth: 210, sheetHeight: 148, orientation: "landscape", margin: 5, gap: 3, includeCoupon: false }, 205, 100)?.message).toMatch(/Source panel cannot fit/i);
  });

  it("explains the derived tilt", () => {
    render(<BoxDialog panelHeight={100} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Tilted panel: 17\.5° rising toward rear/i);
  });
});
