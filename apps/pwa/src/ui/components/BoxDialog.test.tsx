import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoxDialog } from "./BoxDialog";

describe("BoxDialog", () => {
  it("keeps fabrication settings under one collapsed Advanced section", () => {
    render(<BoxDialog onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Depth")).toBeTruthy();
    expect(screen.getByLabelText("Front height")).toBeTruthy();
    expect(screen.getByLabelText("Rear height")).toBeTruthy();
    expect(screen.getByLabelText("Stock thickness")).not.toBeVisible();
    fireEvent.click(screen.getByText("Advanced"));
    expect(screen.getByLabelText("Stock thickness")).toHaveValue(3);
    expect(screen.getByLabelText("Fit clearance")).toHaveValue(0.15);
    expect(screen.getByLabelText("Finger target")).toHaveValue(8);
  });
});
